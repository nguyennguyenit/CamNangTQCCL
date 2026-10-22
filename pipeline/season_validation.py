"""Pure canonical fingerprints and seasonal configuration/link contracts."""
import hashlib

from pipeline.common import canonical_json

CONFIG_FIELDS = ('schemaVersion', 'id', 'teamId', 'scenarioId', 'rulesetId', 'unitTypes', 'heroSlots', 'requirements', 'effectBundles')


def canonical_bytes(value):
    def validate(item):
        if item is None or isinstance(item, (str, bool)):
            return
        if type(item) is int and abs(item) <= 9007199254740991:
            return
        if isinstance(item, list):
            for child in item: validate(child)
            return
        if isinstance(item, dict) and all(isinstance(key, str) for key in item):
            for child in item.values(): validate(child)
            return
        raise ValueError('canonical fingerprint requires JSON with safe integer numbers')
    validate(value)
    return canonical_json(value).encode('utf-8')


def fingerprint(value):
    return 'sha256:' + hashlib.sha256(canonical_bytes(value)).hexdigest()


def config_fingerprint(config):
    return fingerprint({key: config[key] for key in CONFIG_FIELDS})


def content_fingerprint(value):
    def project(item):
        if isinstance(item, list):
            return [project(child) for child in item]
        if isinstance(item, dict):
            return {key: project(child) for key, child in item.items() if key not in ('sourceLocator', 'contentFingerprint', 'recordId')}
        return item
    return fingerprint(project(value))


def raw_text(value, maximum=20000, nonempty=False):
    import unicodedata
    if not isinstance(value, str) or len(value) > maximum or (nonempty and not value.strip()):
        raise ValueError('invalid raw text')
    if any(unicodedata.category(char).startswith('C') and char not in '\r\n\t' for char in value):
        raise ValueError('control character in raw text')
    return value


def sha256(value):
    import re
    if not isinstance(value,str) or not re.fullmatch(r'sha256:[a-f0-9]{64}',value):
        raise ValueError('invalid SHA256')
    return value


def dictionary_ids(catalog):
    import re
    import unicodedata
    result = {}
    for dataset,kind in (('heroes-dict','hero'),('tactics','tactic'),('books-dict','book')):
        rows = catalog.get(dataset)
        if not isinstance(rows,list):
            raise ValueError('canonical dictionaries required')
        ids = set()
        entries = {}
        ambiguous = set()
        for row in rows:
            if kind == 'book':
                book_id = row.get('id')
                if not isinstance(book_id,str) or not re.fullmatch(r'book:[a-z0-9]+(?:-[a-z0-9]+)*',book_id):
                    raise ValueError('book dictionary row requires a frozen id')
                if book_id in ids:
                    raise ValueError('duplicate book dictionary id')
                ids.add(book_id)
                continue
            name = row.get('viet')
            if not isinstance(name,str):
                raise ValueError('dictionary name required')
            if kind == 'hero':
                name = re.sub(r'[\x00-\x1f\x7f]', ' ', name)
                name = re.sub(r'\s+', ' ', name).strip()
                while re.search(r'\s*[(（][^()（）]*[)）]\s*$',name):
                    name = re.sub(r'\s*[(（][^()（）]*[)）]\s*$', '',name).strip()
            normalized = ''.join(char for char in unicodedata.normalize('NFD',name.lower()) if not '\u0300' <= char <= '\u036f').replace('đ','d')
            slug = re.sub(r'[^a-z0-9]+','-',normalized).strip('-')
            if not slug:
                raise ValueError('empty canonical identity')
            key = kind+':'+slug
            identity = (row['viet'], row.get('chinese'))
            if key in entries and entries[key] != identity:
                ambiguous.add(key)
            entries[key] = identity
            ids.add(key)
        result[kind] = ids - ambiguous
    return result


def validate_canonical_evidence(evidence, catalog):
    identities = dictionary_ids(catalog)
    for proof in evidence.values():
        ref = proof['canonicalRef']
        if ref is not None and (ref['kind'] not in identities or ref['id'] not in identities[ref['kind']]):
            raise ValueError('canonicalRef missing from dictionary')
    return identities


def validate_bundle(configs, evaluations, links, scenarios, evidence, legacy, catalog):
    from .build_season_data import array, record, identifier, unique_records, version, review_status, evidence_refs, require_claim, provenance, source_season, text
    identities = validate_canonical_evidence(evidence,catalog)
    config_map = unique_records(configs)
    evaluation_map = unique_records(evaluations)
    link_map = unique_records(links)
    team_ids = {identifier(row.get('id')) for row in array(legacy.get('teams'))}

    def pair(item, nullable=False):
        sid,rid=item['scenarioId'],item['rulesetId']
        if sid is None and nullable and rid is None:
            return None
        if identifier(sid) not in scenarios:
            raise ValueError('unknown scenario')
        if rid is None and nullable:
            return None
        rid=identifier(rid)
        rule=next((row for row in scenarios[sid]['rulesets'] if row['id']==rid),None)
        if rule is None:
            raise ValueError('unknown ruleset')
        return rule

    def refs(values, allowed, nonempty=False):
        result = [identifier(value) for value in array(values)]
        if len(set(result))!=len(result) or any(value not in allowed for value in result) or (nonempty and not result):
            raise ValueError('duplicate, unknown, or missing reference')
        return result

    def reviewed(item):
        review_status(item['reviewStatus'])
        return item['reviewStatus']=='reviewed'

    for config in config_map.values():
        record(config,CONFIG_FIELDS+('reviewStatus','evidenceRefs','notes'))
        version(config['schemaVersion'])
        if identifier(config['teamId']) not in team_ids:
            raise ValueError('unknown canonical team')
        rule=pair(config)
        active=reviewed(config)
        proofs=evidence_refs(config['evidenceRefs'],evidence,active)
        refs(config['unitTypes'], {'Kỵ','Cung','Khiên','Thương','Xe'}, True)
        if len(array(config['heroSlots']))!=3:
            raise ValueError('config requires three hero slots')
        for slot in config['heroSlots']:
            record(slot,('heroRefs','tacticSlots','bookSlots','statFocusRaw'))
            refs(slot['heroRefs'],identities['hero'],True)
            raw_text(slot['statFocusRaw'])
            for field,ref_field,kind,count in (('tacticSlots','tacticRefs','tactic',2),('bookSlots','bookRefs','book',3)):
                if len(array(slot[field]))!=count:
                    raise ValueError('invalid ordered slot count')
                for choice in slot[field]:
                    record(choice,(ref_field,))
                    refs(choice[ref_field],identities[kind],kind=='tactic')
        requirements=unique_records(config['requirements'])
        bundles=unique_records(config['effectBundles'])
        for requirement in requirements.values():
            record(requirement,('id','kind','mandatory','reviewStatus','descriptionRaw','evidenceRefs'))
            if requirement['kind'] not in ('advisor','proficiency','order','troop-mod','other') or type(requirement['mandatory']) is not bool:
                raise ValueError('invalid requirement')
            raw_text(requirement['descriptionRaw'],nonempty=True)
            evidence_refs(requirement['evidenceRefs'],evidence,reviewed(requirement))
        for bundle in bundles.values():
            record(bundle,('id','labelRaw','effectsRaw','requirementIds','evidenceRefs'))
            raw_text(bundle['labelRaw'],nonempty=True)
            raw_text(bundle['effectsRaw'],nonempty=True)
            refs(bundle['requirementIds'],requirements)
            evidence_refs(bundle['evidenceRefs'],evidence)
        raw_text(config['notes'])
        if active:
            if scenarios[config['scenarioId']]['reviewStatus']!='reviewed' or rule['reviewStatus']!='reviewed':
                raise ValueError('reviewed config needs reviewed scope')
            require_claim(proofs,'ruleset-applicability',config['scenarioId'],config['rulesetId'])
            digest=config_fingerprint(config)
            if not any(proof.get('configFingerprint')==digest and proof['claim']==dict(kind='ruleset-applicability',scenarioId=config['scenarioId'],rulesetId=config['rulesetId']) for proof in proofs):
                raise ValueError('config-specific evidence fingerprint required')

    eval_configs=set()
    for evaluation in evaluation_map.values():
        record(evaluation,('schemaVersion','id','configId','scenarioId','rulesetId','rankings','sourceScore','defaultRankingId','reviewStatus','reviewNote'))
        version(evaluation['schemaVersion'])
        config=config_map.get(identifier(evaluation['configId']))
        if config is None or evaluation['configId'] in eval_configs:
            raise ValueError('unknown or duplicate evaluated config')
        eval_configs.add(evaluation['configId'])
        pair(evaluation)
        if any(evaluation[key]!=config[key] for key in ('scenarioId','rulesetId')):
            raise ValueError('evaluation scope differs from config')
        active=reviewed(evaluation)
        if active and config['reviewStatus']!='reviewed':
            raise ValueError('reviewed evaluation needs reviewed config')
        raw_text(evaluation['reviewNote'])
        rankings=unique_records(evaluation['rankings'])
        for ranking in rankings.values():
            record(ranking,('id','tier','evidenceRefs'))
            if ranking['tier'] not in ('T0','T0.5','T1','T1.5','T2','T3'):
                raise ValueError('invalid tier')
            ranking_proofs=evidence_refs(ranking['evidenceRefs'],evidence,active)
            if active and not any(proof.get('configFingerprint')==config_fingerprint(config)
                                  and proof['claim']==dict(kind='ruleset-applicability',scenarioId=config['scenarioId'],rulesetId=config['rulesetId'])
                                  for proof in ranking_proofs):
                raise ValueError('ranking needs exact config applicability evidence')
        default=evaluation['defaultRankingId']
        if default is not None and (identifier(default) not in rankings or not active or not evaluation['reviewNote'].strip()):
            raise ValueError('default ranking requires reviewed choice and note')
        score=evaluation['sourceScore']
        if score is not None:
            if not active or config['reviewStatus']!='reviewed':
                raise ValueError('source score requires reviewed evaluation and config')
            validate_score(score,config,evidence,identities)

    seen_records=set()
    for link in link_map.values():
        record(link,('schemaVersion','id','kind','recordId','scenarioId','rulesetId','configIds','reviewStatus','evidenceRefs','target'))
        version(link['schemaVersion'])
        record_id=identifier(link['recordId'])
        if record_id in seen_records or link['kind']!='coexist':
            raise ValueError('duplicate record identity or wrong content kind')
        seen_records.add(record_id)
        rule=pair(link,True)
        active=reviewed(link)
        proofs=evidence_refs(link['evidenceRefs'],evidence,active)
        if active:
            if link['scenarioId'] is None or scenarios[link['scenarioId']]['reviewStatus']!='reviewed' or (rule is not None and rule['reviewStatus']!='reviewed'):
                raise ValueError('reviewed link needs reviewed attribution')
            require_claim(proofs,'scenario-attribution' if rule is None else 'ruleset-applicability',link['scenarioId'],link['rulesetId'])
        for config_id in refs(link['configIds'],config_map):
            config=config_map[config_id]
            if not active or config['reviewStatus']!='reviewed' or any(config[key]!=link[key] for key in ('scenarioId','rulesetId')):
                raise ValueError('linked config must be reviewed at exact scope')
            if not set(config['evidenceRefs']).intersection(link['evidenceRefs']):
                raise ValueError('linked config evidence missing')
        body=link['target']
        if not isinstance(body,dict):
            raise ValueError('content discriminator required')
        if body.get('type')=='legacy-locator':
            record(body,('type','dataset','locator','contentFingerprint'))
            if body['dataset']!='coexist':
                raise ValueError('wrong legacy dataset')
            record(body['locator'],('groupIndex',))
            index=body['locator']['groupIndex']
            groups=array(legacy.get('coexist'))
            if type(index) is not int or not 0<=index<len(groups):
                raise ValueError('invalid legacy locator')
            digest=sha256(body['contentFingerprint'])
            if sum(fingerprint(group)==digest for group in groups)!=1 or fingerprint(groups[index])!=digest:
                raise ValueError('legacy locator fingerprint mismatch or ambiguity')
        elif body.get('type')=='source-owned-coexist':
            validate_source_body(body,seen_records)
            source=body['source']
            if not any(proof['claim']['kind']=='source-observation'
                       and proof['reviewStatus']=='reviewed'
                       and proof.get('snapshotHash')==source['snapshotHash']
                       and proof['provenance']['sourceUrl']==source['url'] for proof in proofs):
                raise ValueError('source snapshot observation evidence required')
            if active and not any(proof['claim']==dict(kind='scenario-attribution' if rule is None else 'ruleset-applicability',scenarioId=link['scenarioId'],rulesetId=link['rulesetId']) and proof['provenance']['sourceUrl']==source['url'] for proof in proofs):
                raise ValueError('source attribution URL mismatch')
        else:
            raise ValueError('unknown content discriminator')
    return config_map,evaluation_map,link_map


def validate_score(score,config,evidence,identities):
    import math
    from .build_season_data import record,identifier,version,array,provenance,source_season,evidence_refs
    record(score,('provider','value','sourceConfigId','sourceSeason','provenance','evidenceRefs','sourceSnapshotHash','configFingerprint','selectionFingerprint','scoredSelection'))
    if score['provider']!='sgsdeck' or type(score['value']) not in (int,float) or not math.isfinite(score['value']) or score['value']<0:
        raise ValueError('invalid source score')
    identifier(score['sourceConfigId']);source_season(score['sourceSeason']);provenance(score['provenance'])
    proofs=evidence_refs(score['evidenceRefs'],evidence,True)
    if score['provenance']['provider']!='sgsdeck' or not any(
        proof.get('snapshotHash')==score['sourceSnapshotHash']
        and proof.get('sourceSeason')==score['sourceSeason']
        and all(proof['provenance'][key]==score['provenance'][key] for key in ('provider','region','sourceUrl'))
        and proof.get('configFingerprint')==score['configFingerprint']
        and proof['claim']==dict(kind='ruleset-applicability',scenarioId=config['scenarioId'],rulesetId=config['rulesetId'])
        for proof in proofs
    ):
        raise ValueError('score source snapshot provenance mismatch')
    if sha256(score['configFingerprint'])!=config_fingerprint(config):
        raise ValueError('score config fingerprint mismatch')
    sha256(score['sourceSnapshotHash'])
    selection=score['scoredSelection']
    record(selection,('schemaVersion','configId','scenarioId','rulesetId','unitType','heroSlots','requirementIds','effectBundleIds'))
    version(selection['schemaVersion'])
    if selection['configId']!=config['id'] or any(selection[key]!=config[key] for key in ('scenarioId','rulesetId')) or selection['unitType'] not in config['unitTypes']:
        raise ValueError('score selection scope mismatch')
    if len(array(selection['heroSlots']))!=3:
        raise ValueError('score selection requires three slots')
    for selected,slot in zip(selection['heroSlots'],config['heroSlots']):
        record(selected,('heroRef','tacticRefs','bookRefs'))
        if selected['heroRef'] not in slot['heroRefs']:
            raise ValueError('score hero selection does not belong to config')
        for field,slot_field,ref_field,count in (('tacticRefs','tacticSlots','tacticRefs',2),('bookRefs','bookSlots','bookRefs',3)):
            if len(array(selected[field]))!=count or any(ref not in choices[ref_field] for ref,choices in zip(selected[field],slot[slot_field])):
                raise ValueError('score selection requires complete ordered references')
    hero_refs=[slot['heroRef'] for slot in selection['heroSlots']]
    tactic_refs=[ref for slot in selection['heroSlots'] for ref in slot['tacticRefs']]
    if len(set(hero_refs))!=3 or len(set(tactic_refs))!=6:
        raise ValueError('source selection repeats hero or tactic resources')
    for field,choices in (('requirementIds',config['requirements']),('effectBundleIds',config['effectBundles'])):
        values=array(selection[field]);allowed={item['id'] for item in choices}
        if any(not isinstance(value,str) for value in values) or values!=sorted(set(values)) or not set(values)<=allowed:
            raise ValueError('score condition selections must be unique sorted known IDs')
    required={item['id'] for item in config['requirements'] if item['mandatory']}
    for bundle in config['effectBundles']:
        if bundle['id'] in selection['effectBundleIds']:
            required.update(bundle['requirementIds'])
    if not required<=set(selection['requirementIds']):
        raise ValueError('mandatory score conditions missing')
    if any(item['reviewStatus']!='reviewed' for item in config['requirements'] if item['id'] in selection['requirementIds']):
        raise ValueError('score selections require reviewed conditions')
    if sha256(score['selectionFingerprint'])!=fingerprint(selection):
        raise ValueError('score selection fingerprint mismatch')
    if not any(proof.get('configFingerprint')==score['configFingerprint'] and proof['claim']==dict(kind='ruleset-applicability',scenarioId=config['scenarioId'],rulesetId=config['rulesetId']) for proof in proofs):
        raise ValueError('score exact config evidence missing')


def validate_source_body(body,seen_records):
    from .build_season_data import record,identifier,array,text
    record(body,('type','source','contentFingerprint','payload'))
    source=record(body['source'],('id','url','sheetId','gid','format','snapshotHash','disclaimerRaw'))
    identifier(source['id']);identifier(source['sheetId']);identifier(source['gid'])
    from .build_season_data import source_url
    source_url(source['url'])
    if source['format']!='csv':
        raise ValueError('unsupported source format')
    sha256(source['snapshotHash']);raw_text(source['disclaimerRaw'],nonempty=True)
    payload=record(body['payload'],('groupLabel','summaryRaw','openingSuggestionsRaw','notesRaw','teams'))
    text(payload['groupLabel'])
    for key in ('summaryRaw','openingSuggestionsRaw','notesRaw'):
        raw_text(payload[key])
    teams=array(payload['teams'])
    if not teams:
        raise ValueError('empty source group')
    for team in teams:
        record(team,('recordId','sourceLocator','contentFingerprint','teamNameRaw','teamName','unitTacticEffectsRaw','heroes'))
        key=identifier(team['recordId'])
        if key in seen_records:
            raise ValueError('duplicate source team identity')
        seen_records.add(key)
        locator=record(team['sourceLocator'],('csvRecordStart','csvRecordEnd','lineStart','lineEnd'))
        if any(type(value) is not int or not 1<=value<=9007199254740991 for value in locator.values()) or locator['csvRecordEnd']-locator['csvRecordStart']!=2 or locator['lineEnd']<locator['lineStart']:
            raise ValueError('invalid source locator')
        raw_text(team['teamNameRaw'],nonempty=True);text(team['teamName']);raw_text(team['unitTacticEffectsRaw'])
        if len(array(team['heroes']))!=3:
            raise ValueError('source team must have three heroes')
        for hero in team['heroes']:
            record(hero,('nameRaw','tacticSlotsRaw','statFocusRaw','bookSlotsRaw'))
            raw_text(hero['nameRaw'],nonempty=True);raw_text(hero['statFocusRaw'])
            for key,count in (('tacticSlotsRaw',2),('bookSlotsRaw',3)):
                if len(array(hero[key]))!=count:
                    raise ValueError('source ordered slot count mismatch')
                for value in hero[key]:raw_text(value)
        if sha256(team['contentFingerprint'])!=content_fingerprint(team):
            raise ValueError('source team content fingerprint mismatch')
    if sha256(body['contentFingerprint'])!=content_fingerprint(payload):
        raise ValueError('source group content fingerprint mismatch')
