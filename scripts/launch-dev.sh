#!/bin/bash
# Launch Inkleaf dev environment in a Terminal tab
osascript -e '
tell application "Terminal"
    activate
    do script "export NVM_DIR=\"$HOME/.nvm\" && source \"$NVM_DIR/nvm.sh\" && export PATH=\"$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH\" && cd /Users/davidneal/Projects/demos/inkleaf && pnpm dev:tauri; exit"
end tell'
