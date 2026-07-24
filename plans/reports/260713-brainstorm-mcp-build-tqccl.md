# Brainstorm: Build MCP Cho TQCCL Team Data

## Pham vi

Chi build MCP. Khong thiet ke GoClaw, Zalo, vision, user memory.

MCP la service read-only:

- doc data live TQCCL
- normalize ten tuong/chien phap
- search game data
- tra build day du
- recommend team cung ton
- check conflict chien phap/tuong
- goi y thay chien phap khi thieu

## Kien truc MCP

```text
External agent/client
  -> Remote MCP Worker
      -> auth Bearer token
      -> doc data tu Cloudflare R2
      -> normalize + filter + recommend
      -> tra JSON ket qua
```

MCP khong luu user state. Moi request phai dua du context can xu ly: roster, current teams, locked tactics, missing tactics, preferences.

## Data live

Data live = MCP doc data moi nhat tu source runtime, khong dung Knowledge snapshot.

Source khuyen nghi: Cloudflare R2 Standard.

Objects:

```text
teams.json
team-tier.json
coexist.json
heroes-dict.json
tactics.json
books-dict.json
```

Ly do dung R2:

- private hon fetch truc tiep Pages
- kiem soat version/cache tot hon
- chi phi MVP gan nhu 0 voi data JSON nho
- deploy data doc lap voi MCP code

Khong dung Infrequent Access. Dung R2 Standard.

## Chi phi R2

R2 co free tier lon:

- 10 GB storage/thang
- 1M Class A operations/thang
- 10M Class B operations/thang
- egress free

MCP doc data bang `GetObject`, tinh Class B. Neu moi request doc 5 file JSON va khong cache, free tier van du khoang 2M request agent/thang. Co cache 60-120s thi chi phi thap hon nua.

Neu vuot free tier:

- storage Standard: `$0.015/GB-month`
- Class B read: `$0.36 / 1M requests`
- Class A write/list: `$4.50 / 1M requests`

## Folder de xuat

```text
mcp-worker/
  package.json
  wrangler.toml
  tsconfig.json
  src/
    index.ts
    auth.ts
    data-loader.ts
    normalize.ts
    search.ts
    team-detail.ts
    coexist-recommender.ts
    replacement-engine.ts
    response-format.ts
```

## Auth

Dung Bearer token.

Request:

```http
Authorization: Bearer <MCP_TOKEN>
```

Worker config:

```text
MCP_BEARER_TOKEN=<secret>
TQCCL_R2_BUCKET=<binding>
DATA_CACHE_TTL_SECONDS=60
```

Khong log token. Sai token tra `401`.

## Tools can co

### get_data_version

Muc dich: kiem tra MCP dang doc dung data moi.

Tra:

- data version neu co
- hash tung file
- object updatedAt
- count team/tier/tactic/hero/book

### normalize_game_entities

Muc dich: map ten tho ve ten chuan trong data.

Input:

```json
{
  "heroes": ["Chu Tuan", "Thu Thu", "Vien Thieu"],
  "tactics": ["Cat Xuong", "Vo Duong"],
  "teams": []
}
```

Output:

```json
{
  "heroes": [
    {"input": "Chu Tuan", "normalized": "SP Chu Tuấn", "confidence": 0.91}
  ],
  "unresolved": []
}
```

### search_game_data

Muc dich: fuzzy search tướng, chiến pháp, team, binh thư.

Ho tro:

- bo dau tieng Viet
- alias SP/CO
- partial name
- Han Viet/Han neu data co

### get_team_detail

Muc dich: tra full build theo `teamId`.

Tra:

- tướng
- chiến pháp
- binh thư
- unit type
- tier
- notes
- counters neu co
- booksStatus neu thieu data

### recommend_team_build

Muc dich: user hoi build 1 team cu the.

Input:

```json
{
  "heroes": ["SP Viên Thiệu", "SP Chu Tuấn", "Thư Thụ"],
  "availableTactics": ["Gió Táp Mưa Sa"],
  "lockedTactics": ["Thuyền Cỏ Mượn Tên"],
  "allowMovingTactics": false
}
```

Output:

- build recommended
- missing tactics
- conflicts
- replacements
- tradeoffs

### recommend_coexist_teams

Tool chinh.

Input:

```json
{
  "availableHeroes": ["SP Viên Thiệu", "SP Chu Tuấn", "Thư Thụ"],
  "currentTeams": [
    {
      "name": "Chu Thiệu Tam Tiên",
      "heroes": ["Chu Thiệu", "Trương Giác", "Tả Từ"],
      "tactics": ["Thái Bình Đạo Pháp", "Sĩ Biệt Tam Nhật"]
    }
  ],
  "lockedTactics": ["Thuyền Cỏ Mượn Tên", "Đương Phong Thôi Quyết"],
  "maxTier": "T1",
  "allowMovingTactics": false,
  "limit": 10
}
```

Output:

```json
{
  "dataVersion": "2026-07-13",
  "lockedTactics": ["Thuyền Cỏ Mượn Tên", "Đương Phong Thôi Quyết"],
  "candidates": [
    {
      "teamId": "moi-phe-140",
      "name": "Thiệu Tuấn Thụ",
      "tier": "T0",
      "unitType": ["Cung"],
      "coexistQuality": "clean",
      "heroes": [
        {
          "name": "SP Viên Thiệu",
          "tactics": ["Xế Đao Chước Địch", "Gió Táp Mưa Sa"],
          "books": ["Thắng Sẽ Càng Mạnh", "Thắng Trận", "Cầm Binh Khí"],
          "statFocus": "Võ lực"
        }
      ],
      "conflicts": [],
      "missingHeroes": [],
      "missingTactics": [],
      "tradeoffs": []
    }
  ]
}
```

### suggest_tactic_replacements

Muc dich: khi thieu chien phap, goi y thay.

Input:

```json
{
  "teamId": "moi-phe-140",
  "missingTactics": ["Anh Thành Tự Thủ"],
  "lockedTactics": ["Cắt Xương Trị Độc"],
  "availableTactics": ["Vô Đương Phi Quân"]
}
```

Output:

- replacement
- target hero
- reason
- downgrade/tradeoff
- conflict status

## Response contract

MCP tra JSON structured, khong tra prose dai.

Agent/client ben ngoai quyet dinh format hien thi.

MCP co the tra `displayHints`:

```json
{
  "displayHints": {
    "defaultStyle": "short",
    "sections": ["recommendation", "build", "conflicts", "tradeoffs"]
  }
}
```

## Cache

Khuyen nghi:

- cache in-memory trong Worker 60-120s
- cache key theo object etag/hash
- `get_data_version` co the force refresh

Neu data moi deploy ma can thay ngay: goi endpoint/tool refresh cache co auth, hoac dat TTL ngan.

## Validation

Can test fixtures:

1. Co roster du tuong, khong conflict, tra team.
2. Co conflict locked tactic, loai team.
3. Thieu chien phap, tra replacement.
4. Thieu binh thu trong data, tra `booksStatus: missing_in_data`.
5. Normalize ten sai/khong dau.
6. Data R2 thieu file, tool fail co message ro.

## Ranh gioi

Out of scope MVP:

- doc anh
- luu roster user
- quan ly Zalo
- user memory
- sua data repo
- ghi team moi vao JSON
- web research meta

In scope MVP:

- read-only remote MCP Worker
- R2 data source
- Bearer auth
- full build + binh thu
- recommend cung ton
- replacement khi thieu chien phap

## Khuyen nghi

Build `mcp-worker/` trong repo nay, deploy Cloudflare Worker. Data dua len R2 Standard. MCP stateless/read-only. Tool workflow chinh la `recommend_coexist_teams`; cac tool khac bo tro search/detail/replace.

## Unresolved Questions

- CI upload `data/*.json` len R2 theo workflow nao?
- Data version nen lay tu file rieng hay tinh hash tu object?
- Co can tool admin refresh cache khong?
