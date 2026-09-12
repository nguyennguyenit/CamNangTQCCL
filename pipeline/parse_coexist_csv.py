"""Parse source-owned Cùng Tồn CSV; no inferred identities or combinations."""
import copy
import csv
import hashlib
import io
import re
from .season_validation import content_fingerprint, raw_text, sha256
from .build_season_data import record, identifier, array, version

HEADER=['Tiến cử khai hoang','Tên đội','Võ Tướng','Chiến Pháp','','Thêm điểm','Binh Thư','','','Hiệu Quả Cải Tạo Chiến Pháp Binh Chủng']


def parse_coexist_csv(csv_text, *, expected_hash=None):
    raw_text(csv_text,maximum=2000000,nonempty=True)
    if expected_hash is not None and sha256(expected_hash)!='sha256:'+hashlib.sha256(csv_text.encode('utf-8')).hexdigest():
        raise ValueError('snapshot hash mismatch')
    reader=csv.reader(io.StringIO(csv_text,newline=''),strict=True)
    groups=[];group=None;team=None;expect_header=False;notes=False;disclaimer=[]

    def complete_team():
        if team is not None and len(team['heroes'])!=3:
            raise ValueError('incomplete three-hero team')

    try:
        for number,row in enumerate(reader,1):
            line_end=reader.line_num
            # Embedded quoted newlines belong to the same CSV record.
            line_start=line_end-sum(value.count('\n') for value in row)
            if len(row)!=10:
                raise ValueError('source must have exactly ten columns')
            for cell in row:raw_text(cell)
            if expect_header:
                if row!=HEADER:raise ValueError('source header drift')
                expect_header=False
                continue
            if re.fullmatch(r'Cùng tồn \d+',row[0]):
                complete_team()
                if group is not None and not group['teams']:raise ValueError('empty source group')
                if any(row[2:]) or not row[1].strip():raise ValueError('invalid group marker')
                group=dict(groupLabel=row[0],summaryRaw=row[1],openingSuggestionsRaw='',notesRaw='',teams=[])
                groups.append(group);team=None;expect_header=True;notes=False
                continue
            if not any(row):
                complete_team();team=None
                continue
            if group is None:
                if any(row[1:]):raise ValueError('unexpected content before group')
                disclaimer.append(row[0]);continue
            if row[0]:
                if row[0]=='Ghi chú':notes=True
                field='notesRaw' if notes else 'openingSuggestionsRaw'
                group[field]+=('\n' if group[field] else '')+row[0]
            if not row[2]:
                raise ValueError('orphan source content without hero')
            if row[1]:
                complete_team()
                name=re.sub(r'\s+\d+C\s*$','',row[1])
                name=re.sub(r'\s+',' ',name).strip()
                if not name:raise ValueError('empty team name')
                team=dict(teamNameRaw=row[1],teamName=name,unitTacticEffectsRaw=row[9],heroes=[],sourceLocator=dict(csvRecordStart=number,csvRecordEnd=number,lineStart=line_start,lineEnd=line_end))
                group['teams'].append(team)
            elif team is None or len(team['heroes'])>=3:
                raise ValueError('orphan continuation hero')
            elif row[9]:
                raise ValueError('unverified continuation effect ownership')
            team['heroes'].append(dict(nameRaw=row[2],tacticSlotsRaw=row[3:5],statFocusRaw=row[5],bookSlotsRaw=row[6:9]))
            team['sourceLocator'].update(csvRecordEnd=number,lineEnd=line_end)
    except csv.Error as error:
        raise ValueError('malformed CSV') from error
    complete_team()
    if expect_header or not groups or not disclaimer or not groups[-1]['teams']:
        raise ValueError('incomplete source snapshot')
    return dict(disclaimerRaw='\n'.join(disclaimer),groups=groups)


def build_content_links(csv_text,identity_map,source,*,scenario_id,evidence_refs):
    """Attach reviewed opaque record IDs to exact content revisions, never rows."""
    parsed=parse_coexist_csv(csv_text,expected_hash=source['snapshotHash'])
    record(identity_map,('schemaVersion','sourceId','reviewStatus','groups'))
    version(identity_map['schemaVersion'])
    if identity_map['reviewStatus']!='reviewed' or identity_map['sourceId']!=source['id']:
        raise ValueError('reviewed source identity map required')
    seen_ids=set();revisions={}
    for group in array(identity_map['groups']):
        record(group,('recordId','contentFingerprint','teams'))
        key=identifier(group['recordId']);digest=sha256(group['contentFingerprint'])
        if key in seen_ids or digest in revisions:raise ValueError('ambiguous group identity map')
        seen_ids.add(key);revisions[digest]=group
        for team in array(group['teams']):
            record(team,('recordId','contentFingerprint'))
            key=identifier(team['recordId']);sha256(team['contentFingerprint'])
            if key in seen_ids:raise ValueError('duplicate source record ID')
            seen_ids.add(key)
    links=[];used=set()
    for payload in parsed['groups']:
        digest=content_fingerprint(payload)
        if digest not in revisions or digest in used:raise ValueError('unreviewed or duplicate group revision')
        used.add(digest);mapping=revisions[digest]
        teams_by_revision={team['contentFingerprint']:team for team in mapping['teams']}
        if len(teams_by_revision)!=len(mapping['teams']):raise ValueError('ambiguous team revision')
        team_used=set()
        for team in payload['teams']:
            revision=content_fingerprint(team)
            if revision not in teams_by_revision or revision in team_used:raise ValueError('unreviewed or duplicate team revision')
            team_used.add(revision)
            team.update(recordId=teams_by_revision[revision]['recordId'],contentFingerprint=revision)
        if team_used!=set(teams_by_revision):raise ValueError('missing reviewed teams')
        source_copy=copy.deepcopy(source);source_copy['disclaimerRaw']=parsed['disclaimerRaw']
        links.append(dict(schemaVersion=1,id='link:'+mapping['recordId'],kind='coexist',recordId=mapping['recordId'],scenarioId=scenario_id,rulesetId=None,configIds=[],reviewStatus='reviewed',evidenceRefs=list(evidence_refs),target=dict(type='source-owned-coexist',source=source_copy,contentFingerprint=digest,payload=payload)))
    if used!=set(revisions):raise ValueError('missing reviewed groups')
    return links
