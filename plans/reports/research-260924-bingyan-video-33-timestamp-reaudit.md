# Binh Diễn Xuân Thu: kiểm lại 33 nhãn thời gian trong livestream TFf

- Research date: 2026-09-24 (Asia/Saigon)
- Branch: source/video verification
- Topic lock: The user's complete 33-row list of team names and YouTube timestamps for [TFf 又一Day's 1:34:51 pioneer-server livestream](https://www.youtube.com/watch?v=0c_7C-7mi-0).
- Scope: user's chosen Binh Diễn Xuân Thu season; user server and live patch unknown. The user's labels are leads, not instructions or direct evidence from the video.
- Previous records: [17-label video audit](research-260924-bingyan-video-17-claim-audit.md) and [eight additional team terms](research-260924-bingyan-eight-extra-team-terms.md). This report adds the newly supplied timestamps and corrects their visible-frame attribution. The prior five-team allocation is unchanged.
- Subsequent correction: [audio reassessment](research-260924-bingyan-video-audio-reassessment.md) generated a local ASR draft after the user explicitly requested download/extraction. This report remains valid for **what the frames/chat showed**, but its speech-access limitation and any inference that a topic was not spoken have been superseded.

## Access boundary

The video was opened in the user's Chrome tab. The 15 distinct positions in the previous audit were already directly viewed. This pass directly sought and captured the 16 additional distinct positions (07:16, 14:59, 15:51, 30:23, 32:53, 33:28, 33:56, 38:28, 38:47, 41:51, 49:39, 49:58, 51:56, 57:28, 1:03:01, 1:16:49), yielding 31 distinct positions across the two passes. Browser navigation loaded video around the requested second, generally +1–2 seconds. The YouTube player reports **no captions**, and `exportYouTubeTranscript()` returned **“No transcript is available for this YouTube video.”** Follow-up on 2026-09-24 confirmed that the public watch page's `ytInitialPlayerResponse` has no `captions`/`captionTracks` entry and `https://www.youtube.com/api/timedtext?type=list&v=0c_7C-7mi-0` returns an empty body. A search for the exact video ID/title found no independently published transcript. A native ASR package is not installed in the bundled Python runtime, and no configured Gemini audio credential was present (only presence was checked, never its value). Complete Cantonese speech was not transcribed or independently listened to. Thus **Đã đối chiếu** below refers only to a visible video frame or chat line; a claim that the speaker pronounced any given team name is **Chưa xác minh**.

## Row-by-row timestamp check

| # | User time and claimed label | Visible at that time | Evidence conclusion |
| --- | --- | --- | --- |
| 1 | [00:39](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=39s) Lão Tam Tiên | Game loading/login. | Frame **Đã đối chiếu**; team introduction **Chưa xác minh**. A separate creator comment later discusses Tam Tiên, not proof of this timestamp. |
| 2 | [02:09](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=129s) Chu Du Thủ Pháp/Phi Hùng | Three-general troop-selection screen. | No complete Chu Du loadout visible; **Chưa xác minh**. |
| 3 | [02:29](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=149s) Đại Kiều Phi Hùng | Same troop-selection sequence. | No complete Đại Kiều Phi Hùng loadout visible; **Chưa xác minh**. |
| 4 | [03:39](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=219s) Phú Quý Kỵ | Battle report showing Đại Kiều–Trương Liêu–Tả Từ side. | Report **Đã đối chiếu**; a Phú Quý Kỵ presentation at this time **Chưa xác minh**. |
| 5 | [05:59](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=359s) Hoàng Mã Thương | Battle report against Hứa Du–SP Hoàng Phổ Tung–SP Mã Siêu. | This matchup **Đã đối chiếu**; it is not an account-specific recommendation. |
| 6 | [07:16](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=436s) Đại Kiều Cung | Battle-report detail with unit cards/tactics. | Report **Đã đối chiếu**; exact Đại Kiều Cung name and six-tactic build **Chưa xác minh**. |
| 7 | [12:21](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=741s) Ngũ Mưu Thần | `飛熊軍` refinement screen. | No Ngũ Mưu lineup at this instant; **Chưa xác minh**. |
| 8 | [12:21](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=741s) Khương Duy Phi Hùng Thái Úy | Same `飛熊軍` screen. | Refinement **Đã đối chiếu**; the creator's separate comment calls Khương Duy Phi Hùng Thái Úy fairly strong, but this frame is not its full build. |
| 9 | [12:21](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=741s) Kỳ Lân Cung | Same `飛熊軍` screen. | No Khương Duy–Gia Cát Lượng–Bàng Thống lineup visible; **Chưa xác minh**. |
| 10 | [14:59](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=899s) Đương Phong Cung | `無當飛軍` refinement explanation and traits. | Troop screen **Đã đối chiếu**; Đương Phong team **Chưa xác minh**. The tactic's proper name is `當鋒摧決` (Đương Phong Thôi Quyết), not “Tồi Sương.” |
| 11 | [15:51](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=951s) Ôn Thần Cung | `錦帆軍` refinement explanation and traits. | Troop screen **Đã đối chiếu**; a distinct Ôn Thần Cung **Chưa xác minh**. |
| 12 | [18:13](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=1093s) Mạng Hồng/Tướng Mã Thương | `大戟士` refinement screen. | Troop screen **Đã đối chiếu**; exact 網紅槍 / 將馬槍 build **Chưa xác minh**. |
| 13 | [18:49](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=1129s) Thanh Châu/Quan Quan Trương | `青州兵` refinement screen. | Troop screen **Đã đối chiếu**. Later at 27:28 a Guan trio with 精·青州 is displayed in one report. |
| 14 | [27:28](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=1648s) Cơ Quan Thương | Battle report of Quan Vũ–Trương Phi–Quan Ngân Bình with 精·青州兵. | One Qingzhou Guan-trio report **Đã đối chiếu**; a second, distinct 機關槍 lineup **Chưa xác minh**. |
| 15 | [28:56](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=1736s) Long Hổ Thương | City screen; a chat user says `兵演春秋，龍虎服` while answering a server question. | `龍虎服` is a **server**, **Đã đối chiếu**; distinct 龍虎槍 **Chưa xác minh**. |
| 16 | [30:23](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=1823s) Chạm Sứ ~8k | Campaign map. Nearby viewer chat asks whether something can be used `做碰瓷開荒`. | Viewer question **Đã đối chiếu**; video frame does not establish an 8,000-troop rule or a full team. |
| 17 | [32:07](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=1927s) Võ Phong Thương | Battle-report search filter with general portraits. | No complete 武鋒槍 loadout visible; **Chưa xác minh**. |
| 18 | [32:53](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=1973s) `洞車槍` | `青州兵` refinement explanation and trait options. | Troop screen **Đã đối chiếu**; `洞車槍` as an exact team name **Chưa xác minh**. |
| 19 | [33:28](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=2008s) Võng Hồng Đại Kiều | Battle-report detail with several unit cards. | Report **Đã đối chiếu**; no visible full 網紅大喬 configuration; **Chưa xác minh**. |
| 20 | [33:56](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=2036s) Toàn SP Đội | Same battle-report detail as at 33:28. | Report **Đã đối chiếu**; not a separate all-SP team presentation; **Chưa xác minh**. |
| 21 | [38:28](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=2308s) Vệ Quân Đội | Campaign map. | No exact 衛軍隊 roster or tactic description visible; **Chưa xác minh**. |
| 22 | [38:47](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=2327s) Mã Cung | Battle-report search filter, with Trương Phi selected. | No Mã Siêu bow build visible; **Chưa xác minh**. |
| 23 | [41:51](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=2511s) Môn Đồng/Ma Đồng Thuẫn | Battle-report result. | Report **Đã đối chiếu**; exact `門桶盾/魔桶盾` name/configuration **Chưa xác minh**. |
| 24 | [45:02](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=2702s) Thái Sử Từ Cung | `精·象兵` refinement screen. | Troop screen **Đã đối chiếu**; this instant does not display a Thái Sử Từ Cung loadout. |
| 25 | [49:39](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=2979s) “Đơn Dương” Binh | List of battle reports. | No Danyang troop screen at this instant; **Chưa xác minh** as a team. Correct troop spelling: `丹陽兵` (Đan Dương). |
| 26 | [49:58](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=2998s) Vạn Thần Đội | Battle-report result with Lữ Bố/Tả Từ visible. | Report **Đã đối chiếu**; exact `萬神隊` and claimed tactic **Chưa xác minh**. |
| 27 | [51:04](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=3064s) Đào Viên Thương / Tam Thế | `藤甲兵` refinement screen. | No Đào Viên Thương or separate Tam Thế build visible; **Chưa xác minh**. |
| 28 | [51:56](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=3116s) Pháp Quan Thương | `丹陽兵` refinement explanation and options. | Danyang screen **Đã đối chiếu**; SP Quan Vũ spear build **Chưa xác minh**. |
| 29 | [52:44](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=3164s) Nữ Vương Thuẫn | Campaign map; a viewer asks `女皇丹陽得唔得`. | Viewer question **Đã đối chiếu**; no full 女王盾 build at this instant. |
| 30 | [57:28](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=3448s) Đằng Giáp | Battle-report result, not a troop-refinement screen. | Exact 藤甲 team attribution at this time **Chưa xác minh**. Actual 藤甲 screen is at 51:04. |
| 31 | [1:03:01](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=3781s) Quốc Miễn Đội | Campaign map. | Exact `國免隊` name/configuration **Chưa xác minh**. |
| 32 | [1:07:35](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=4055s) Vô Song/Hương Hương | Campaign map and viewer chat. | No full Vô Song or Tôn Thượng Hương build visible at this instant; **Chưa xác minh**. |
| 33 | [1:16:49](https://www.youtube.com/watch?v=0c_7C-7mi-0&t=4609s) QQ/Kiều Kiều Cung | Battle-report result. | Report **Đã đối chiếu**; exact QQ/姬姬弓 lineup **Chưa xác minh**. |

## Corrections and account implications

- The list has **33 labels but 31 distinct timestamps**: three claims share 12:21, and two share 51:04 as a combined row. Repeating a timestamp does not establish multiple complete teams.
- Clearly verified on-screen troop refinements include Phi Hùng at 12:21, Vô Đương at 14:59, Cẩm Phàm at 15:51, Đại Kích at 18:13, Thanh Châu at 18:49 and 32:53, Đằng Giáp at 51:04, Đan Dương at 51:56, and Tinh·Tượng at 45:02. These screens describe mechanics, not complete three-general team templates.
- Source-supported account choices remain those in [the existing four-refined-plus-one-ordinary plan](research-260923-bingyan-replace-zero-red-huangma-shop.md). Exact OG SGSDeck sources for the chosen Khương Duy Phi Hùng and Cam Ninh Cẩm Phàm are already linked there. A Qingzhou Guan trio would reallocate high-red Quan Vũ/Trương Phi from Đào Viên; it is not a sixth coexist team. The user's SP Quan Vũ and Mã Đại absence rules out the exact OG Pháp Quan Thuẫn, irrespective of what was spoken in the stream.
- For unverified label-to-roster pairs such as `洞車槍`, `國免隊`, `萬神隊`, `QQ隊`, and `門桶盾`, **chưa có mốc SGSDeck đã xác minh** in this video audit. The exact spoken wording remains unknown. Do not infer a game mechanic, tier, score, or tactic holder from a likely speech-to-text error.

## Budget and limits

The user's earlier instruction waived the research skill's default external-call ceiling. Topic: verification of this same livestream and team recommendations; limit unrestricted; used at least 37 external browser state/navigation/media/transcript operations in this recheck, with cumulative earlier-topic count unknown; remaining unrestricted. Local snapshot/report reads do not consume external calls. No video was downloaded, no caption or audio transcript existed, and no product data, team tier, or Git history was changed.
