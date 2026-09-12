# Runtime setup — 2026-09-09

- Official release index confirmed v24.20.0 as latest v24, released 2026-08-26: https://nodejs.org/dist/index.json.
- `nvm install 24.20.0`: official darwin-arm64 archive downloaded; SHA-256 checksums matched.
- `nvm alias default 24.20.0`; new zsh and fish shells resolve `/Users/plateau/.nvm/versions/node/v24.20.0/bin/node`, version v24.20.0; npm 11.19.0.
- Added `~/.config/fish/conf.d/node-runtime.fish` to select the installed runtime. Existing CLI paths retained.
- Removed only the npm user configuration `prefix` key (previous value `~/.npm-global`) because nvm rejected that override. Existing global packages and their PATH entry retained; future global npm installs use the selected nvm runtime.
- Retained `~/.nvm/versions/node/v22.16.0/bin/node` (verified v22.16.0), existing 24.14 installation and standalone `/usr/local/bin/node`.
- Existing open shells retain their environment until restarted. Noninteractive harness commands select 24.20 with explicit PATH.
- Non-PTY zsh probe produced a gitstatus terminal initialization warning; Node/npm resolved correctly and the nvm prefix warning is gone. Shell prompt configuration was not changed.
- Root and MCP engine ranges now `>=24.20.0 <25`; `.node-version` owns exact 24.20.0; lock metadata updated without dependency changes. CI already consumes this pin.
- README and deployment guide updated. Completed Khai hoang plans and historical reports retain Node 22 evidence. No remote Pages/Worker settings changed.

## WIP preservation

Pre-change hashes captured for existing modified/untracked files. Source WIP is unchanged except the authorized README runtime requirement; its existing research link remains. Three Khai hoang phase files changed concurrently outside this task and were not reverted. Final checks are recorded separately.
