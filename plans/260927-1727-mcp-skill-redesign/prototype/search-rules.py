#!/usr/bin/env python3
"""Offline design probe: mandatory rules plus ranked guidance, never rule execution."""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata

DATA = Path(__file__).with_name('rules.json')
WORKFLOWS = {'lookup', 'coexist', 'research'}
CONTEXT_KEYS = {'seasonal', 'configChanged'}


def tokens(text):
    text = ''.join(c for c in unicodedata.normalize('NFD', text.casefold())
                   if unicodedata.category(c) != 'Mn').replace('đ', 'd')
    words = re.findall(r'[a-z0-9]+', text)
    for segment in re.findall(r'[\u3400-\u9fff]+', text):
        words.extend(segment)
        words.extend(segment[i:i + 2] for i in range(len(segment) - 1))
    return words


def load_rules(path):
    raw = path.read_bytes()
    doc = json.loads(raw)
    if doc.get('schemaVersion') != 1 or not isinstance(doc.get('rules'), list):
        raise ValueError('unsupported rule dataset')
    seen = set()
    for rule in doc['rules']:
        if rule['id'] in seen or rule['kind'] not in {'required', 'guidance'}:
            raise ValueError('duplicate id or invalid kind')
        seen.add(rule['id'])
        if not set(rule['workflows']) <= WORKFLOWS or not rule['workflows']:
            raise ValueError('unknown workflow')
        when = rule['when']
        if not isinstance(when, dict) or not set(when) <= CONTEXT_KEYS:
            raise ValueError('unknown condition')
        if any(type(value) is not bool for value in when.values()):
            raise ValueError('condition must be boolean')
    return doc['rules'], 'sha256:' + hashlib.sha256(raw).hexdigest()


def retrieve(query, workflow, context=None, limit=3, path=DATA):
    context = context or {}
    if workflow not in WORKFLOWS or type(limit) is not int or not 1 <= limit <= 10:
        raise ValueError('invalid workflow or limit')
    if len(query) > 256 or not set(context) <= CONTEXT_KEYS:
        raise ValueError('invalid query or context')
    if any(type(value) is not bool for value in context.values()):
        raise ValueError('context must use booleans')
    rules, version = load_rules(path)
    required, candidates, unresolved = [], [], []
    for rule in rules:
        if rule['status'] != 'active' or workflow not in rule['workflows']:
            continue
        # A known false predicate rejects first; missing facts remain unknown.
        if any(key in context and context[key] != value for key, value in rule['when'].items()):
            continue
        missing = sorted(set(rule['when']) - set(context))
        if missing:
            unresolved.append({'ruleId': rule['id'], 'missing': missing})
            continue
        (required if rule['kind'] == 'required' else candidates).append(rule)
    documents = [tokens(' '.join((r['title'], r['terms'], r['guidance']))) for r in candidates]
    lengths = [len(doc) for doc in documents]
    avg = sum(lengths) / len(lengths) if lengths else 1
    frequencies = Counter(term for doc in documents for term in set(doc))
    query_terms = set(tokens(query))
    ranked = []
    for rule, doc in zip(candidates, documents):
        counts = Counter(doc)
        score = 0.0
        for term in query_terms:
            tf = counts[term]
            if tf:
                idf = math.log(1 + (len(documents) - frequencies[term] + 0.5) / (frequencies[term] + 0.5))
                score += idf * tf * 2.5 / (tf + 1.5 * (0.25 + 0.75 * len(doc) / avg))
        if score > 0:
            ranked.append({'rule': rule, 'retrievalScore': round(score, 6)})
    ranked.sort(key=lambda item: (-item['retrievalScore'], item['rule']['id']))
    return {
        'prototype': True, 'knowledgeVersion': version, 'workflow': workflow,
        'requiredRules': sorted(required, key=lambda r: r['id']),
        'guidance': ranked[:limit], 'unresolvedConditions': unresolved,
        'abstained': not ranked, 'abstentionReason': None if ranked else 'no-lexical-match',
        'calibration': 'not-calibrated', 'scoreMeaning': 'lexical-relevance-only',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('query')
    parser.add_argument('--workflow', required=True, choices=sorted(WORKFLOWS))
    parser.add_argument('--context', default='{}', help='JSON boolean facts; omitted is unknown')
    parser.add_argument('--limit', type=int, default=3)
    args = parser.parse_args()
    try:
        context = json.loads(args.context)
        if not isinstance(context, dict):
            raise ValueError('context must be an object')
        print(json.dumps(retrieve(args.query, args.workflow, context, args.limit), ensure_ascii=False, indent=2))
    except (ValueError, KeyError, TypeError) as error:
        parser.error(str(error))
