# Appendix A — Module inventory

<!-- toc -->
## Contents

- [Application modules, largest first](#application-modules-largest-first)
- [Vendor modules by package root](#vendor-modules-by-package-root)

<!-- /toc -->

Recovered by splitting the extracted `index.js` on Bun’s preserved `// src/...` and `// ../../node_modules/...` markers.

- Total marker-delimited segments: **3737**
- Application modules (`src/**`): **446** (4,281,282 bytes)
- Vendor modules (`../../node_modules/**`): **3291** (18,901,012 bytes)
- `start_line`/`end_line` refer to the line range in the extracted `/tmp/oc-src/index.js` bundle.

## Application modules, largest first

| bytes | lines | module | bundle lines |
|---:|---:|---|---|
| 1,762,181 | 9 | `src/provider/models-snapshot.js` | 95100–95108 |
| 104,440 | 3,021 | `src/cli/cmd/tui/routes/session/index.tsx` | 573447–576467 |
| 72,196 | 1,590 | `src/session/prompt.ts` | 353796–355385 |
| 60,617 | 1,728 | `src/lsp/server.ts` | 155866–157593 |
| 60,398 | 1,437 | `src/provider/provider.ts` | 295756–297192 |
| 59,308 | 1,138 | `src/config/config.ts` | 356229–357366 |
| 56,211 | 1,471 | `src/acp/agent.ts` | 579218–580688 |
| 53,546 | 1,389 | `src/provider/sdk/copilot/responses/openai-responses-language-model.ts` | 234229–235617 |
| 47,914 | 1,239 | `src/cli/cmd/github.ts` | 529355–530593 |
| 43,884 | 1,283 | `src/cli/cmd/tui/component/prompt/index.tsx` | 565369–566651 |
| 38,661 | 950 | `src/cli/cmd/tui/routes/session/permission.tsx` | 571515–572464 |
| 30,367 | 837 | `src/provider/transform.ts` | 294621–295457 |
| 29,749 | 799 | `src/session/message-v2.ts` | 187183–187981 |
| 28,822 | 634 | `src/mcp/index.ts` | 352734–353367 |
| 27,677 | 885 | `src/cli/cmd/tui/app.tsx` | 576469–577353 |
| 25,432 | 738 | `src/server/routes/session.ts` | 391848–392585 |
| 25,342 | 585 | `src/session/index.ts` | 355643–356227 |
| 25,187 | 851 | `src/cli/cmd/tui/plugin/runtime.ts` | 569204–570054 |
| 25,185 | 558 | `src/snapshot/index.ts` | 186445–187002 |
| 24,880 | 1,041 | `src/cli/cmd/tui/context/theme.tsx` | 555783–556823 |
| 24,162 | 610 | `src/cli/cmd/tui/routes/session/question.tsx` | 572466–573075 |
| 22,609 | 639 | `src/cli/cmd/mcp.ts` | 525155–525793 |
| 22,370 | 575 | `src/provider/sdk/copilot/chat/openai-compatible-chat-language-model.ts` | 233009–233583 |
| 20,390 | 411 | `src/worktree/index.ts` | 390119–390529 |
| 19,621 | 602 | `src/file/index.ts` | 315907–316508 |
| 19,489 | 593 | `src/cli/cmd/tui/component/prompt/autocomplete.tsx` | 564327–564919 |
| 18,809 | 538 | `src/cli/cmd/run.ts` | 521502–522039 |
| 18,745 | 565 | `src/tool/edit.ts` | 320543–321107 |
| 18,217 | 490 | `src/patch/index.ts` | 339707–340196 |
| 17,924 | 422 | `src/lsp/index.ts` | 186022–186443 |
| 17,671 | 407 | `src/session/processor.ts` | 309525–309931 |
| 17,196 | 485 | `src/plugin/codex.ts` | 358804–359288 |
| 17,172 | 289 | `src/cli/cmd/stats.ts` | 524865–525153 |
| 16,827 | 480 | `src/cli/cmd/tui/ui/dialog-select.tsx` | 558802–559281 |
| 16,252 | 367 | `src/project/project.ts` | 91748–92114 |
| 15,474 | 158 | `src/session/prompt/gemini.txt` | 308293–308450 |
| 15,028 | 447 | `src/cli/cmd/tui/component/dialog-provider.tsx` | 561878–562324 |
| 14,973 | 380 | `src/cli/cmd/tui/context/sync.tsx` | 558198–558577 |
| 14,519 | 429 | `src/cli/cmd/providers.ts` | 523193–523621 |
| 14,302 | 274 | `src/account/index.ts` | 161453–161726 |
| 14,220 | 390 | `src/effect/cross-spawn-spawner.ts` | 92357–92746 |
| 14,113 | 409 | `src/tool/bash.ts` | 314347–314755 |
| 13,916 | 381 | `src/storage/json-migration.ts` | 581053–581433 |
| 13,537 | 280 | `src/installation/index.ts` | 94542–94821 |
| 13,526 | 328 | `src/session/compaction.ts` | 309956–310283 |
| 13,474 | 339 | `src/agent/agent.ts` | 298156–298494 |
| 12,931 | 335 | `src/cli/cmd/tui/component/dialog-status.tsx` | 562659–562993 |
| 12,583 | 394 | `src/cli/cmd/tui/context/local.tsx` | 561296–561689 |
| 11,697 | 257 | `src/cli/cmd/tui/ui/dialog-export-options.tsx` | 573077–573333 |
| 11,692 | 270 | `src/storage/storage.ts` | 165068–165337 |
| 11,183 | 129 | `src/storage/db.ts` | 91030–91158 |
| 11,155 | 150 | `src/session/prompt/beast.txt` | 308142–308291 |
| 11,079 | 226 | `src/share/share-next.ts` | 355416–355641 |
| 11,051 | 311 | `src/pty/index.ts` | 393048–393358 |
| 11,027 | 437 | `src/format/formatter.ts` | 319803–320239 |
| 11,020 | 316 | `src/file/ripgrep.ts` | 307607–307922 |
| 10,639 | 63 | `src/cli/cmd/tui/feature-plugins/home/tips-view.tsx` | 568046–568108 |
| 10,612 | 275 | `src/plugin/github-copilot/copilot.ts` | 359409–359683 |
| 10,218 | 292 | `src/tool/read.ts` | 321546–321837 |
| 10,117 | 282 | `src/server/routes/experimental.ts` | 394031–394312 |
| 10,108 | 265 | `src/permission/index.ts` | 297602–297866 |
| 9,999 | 434 | `src/cli/cmd/tui/plugin/api.tsx` | 570174–570607 |
| 9,981 | 264 | `src/cli/cmd/tui/routes/session/index.tsx` | 571246–571509 |
| 9,829 | 272 | `src/provider/sdk/copilot/responses/convert-to-openai-responses-input.ts` | 233629–233900 |
| 9,662 | 294 | `src/plugin/shared.ts` | 161872–162165 |
| 9,387 | 283 | `src/cli/cmd/uninstall.ts` | 523897–524179 |
| 9,379 | 120 | `src/tool/bash.txt` | 310738–310857 |
| 9,371 | 243 | `src/session/llm.ts` | 308920–309162 |
| 9,369 | 110 | `src/session/prompt/gpt.txt` | 308452–308561 |
| 9,288 | 244 | `src/git/index.ts` | 164823–165066 |
| 9,089 | 251 | `src/tool/apply_patch.ts` | 340235–340485 |
| 8,905 | 170 | `src/tool/todowrite.txt` | 322062–322231 |
| 8,819 | 98 | `src/session/prompt/kimi.txt` | 308563–308660 |
| 8,770 | 264 | `src/util/flock.ts` | 94835–95098 |
| 8,721 | 108 | `src/session/prompt/default.txt` | 308033–308140 |
| 8,707 | 221 | `src/plugin/index.ts` | 398996–399216 |
| 8,675 | 287 | `src/server/routes/tui.ts` | 390968–391254 |
| 8,456 | 209 | `src/skill/index.ts` | 297946–298154 |
| 8,350 | 341 | `src/plugin/install.ts` | 567555–567895 |
| 8,326 | 297 | `src/cli/cmd/tui/component/dialog-workspace-list.tsx` | 563571–563867 |
| 8,277 | 108 | `src/session/prompt/anthropic.txt` | 307924–308031 |
| 8,264 | 198 | `src/session/instruction.ts` | 310285–310482 |
| 8,082 | 240 | `src/server/server.ts` | 398755–398994 |
| 7,990 | 201 | `src/tool/registry.ts` | 340487–340687 |
| 7,808 | 100 | `src/session/prompt/trinity.txt` | 308745–308844 |
| 7,714 | 198 | `src/filesystem/index.ts` | 91549–91746 |
| 7,697 | 278 | `src/cli/cmd/tui/feature-plugins/system/plugins.tsx` | 568872–569149 |
| 7,663 | 210 | `src/lsp/client.ts` | 185811–186020 |
| 7,622 | 235 | `src/server/instance.ts` | 394728–394962 |
| 7,614 | 207 | `src/cli/cmd/tui/ui/spinner.ts` | 564993–565199 |
| 7,493 | 82 | `src/session/prompt/codex.txt` | 308662–308743 |
| 7,379 | 175 | `src/cli/cmd/tui/routes/session/subagent-footer.tsx` | 571070–571244 |
| 7,332 | 245 | `src/server/routes/global.ts` | 395044–395288 |
| 7,216 | 169 | `src/provider/auth.ts` | 394314–394482 |
| 7,101 | 193 | `src/cli/cmd/account.ts` | 522999–523191 |
| 7,097 | 190 | `src/mcp/oauth-callback.ts` | 351987–352176 |
| 6,950 | 206 | `src/cli/cmd/agent.ts` | 523623–523828 |
| 6,899 | 220 | `src/util/filesystem.ts` | 80080–80299 |
| 6,851 | 166 | `src/project/vcs.ts` | 391256–391421 |
| 6,681 | 190 | `src/npm/index.ts` | 155675–155864 |
| 6,613 | 161 | `src/tool/batch.ts` | 321366–321526 |
| 6,259 | 145 | `src/effect/runner.ts` | 340689–340833 |
| 6,257 | 145 | `src/cli/cmd/tui/feature-plugins/sidebar/footer.tsx` | 568726–568870 |
| 6,244 | 160 | `src/session/revert.ts` | 188116–188275 |
| 6,180 | 151 | `src/question/index.ts` | 309373–309523 |
| 6,011 | 112 | `src/flag/flag.ts` | 65860–65971 |
| 6,007 | 165 | `src/cli/cmd/tui/feature-plugins/sidebar/mcp.tsx` | 568243–568407 |
| 5,981 | 162 | `src/format/index.ts` | 320241–320402 |
| 5,936 | 168 | `src/sync/index.ts` | 164654–164821 |
| 5,831 | 165 | `src/tool/webfetch.ts` | 338971–339135 |
| 5,827 | 181 | `src/cli/cmd/tui/thread.ts` | 577494–577674 |
| 5,754 | 174 | `src/cli/cmd/plug.ts` | 581552–581725 |
| 5,733 | 146 | `src/tool/task.ts` | 321915–322060 |
| 5,713 | 125 | `src/mcp/auth.ts` | 351727–351851 |
| 5,612 | 198 | `src/cli/cmd/tui/ui/dialog.tsx` | 556968–557165 |
| 5,598 | 174 | `src/server/routes/mcp.ts` | 393538–393711 |
| 5,516 | 156 | `src/cli/cmd/tui/util/clipboard.ts` | 548194–548349 |
| 5,511 | 140 | `src/cli/cmd/tui/component/dialog-model.tsx` | 561737–561876 |
| 5,428 | 122 | `src/cli/cmd/tui/component/error-component.tsx` | 562326–562447 |
| 5,394 | 141 | `src/provider/models.ts` | 95110–95250 |
| 5,387 | 150 | `src/provider/error.ts` | 187004–187153 |
| 5,374 | 132 | `src/session/summary.ts` | 187983–188114 |
| 5,335 | 135 | `src/file/watcher.ts` | 319667–319801 |
| 5,329 | 245 | `src/cli/cmd/tui/context/theme/mercury.json` | 551803–552047 |
| 5,288 | 177 | `src/server/routes/pty.ts` | 393360–393536 |
| 5,278 | 161 | `src/cli/cmd/tui/ui/dialog-prompt.tsx` | 561119–561279 |
| 5,268 | 147 | `src/command/index.ts` | 353636–353782 |
| 5,208 | 249 | `src/cli/cmd/tui/context/theme/cursor.json` | 549984–550232 |
| 5,198 | 143 | `src/config/paths.ts` | 161728–161870 |
| 5,192 | 154 | `src/index.ts` | 581782–581935 |
| 5,140 | 121 | `src/bus/index.ts` | 161149–161269 |
| 5,063 | 249 | `src/cli/cmd/tui/context/theme/orng.json` | 553142–553390 |
| 5,052 | 78 | `src/agent/generate.txt` | 297403–297480 |
| 5,043 | 242 | `src/cli/cmd/tui/context/theme/gruvbox.json` | 551168–551409 |
| 5,040 | 245 | `src/cli/cmd/tui/context/theme/opencode.json` | 552896–553140 |
| 5,003 | 115 | `src/tool/truncate.ts` | 297287–297401 |
| 4,977 | 243 | `src/cli/cmd/tui/context/theme/tokyonight.json` | 554539–554781 |
| 4,937 | 233 | `src/cli/cmd/tui/context/theme/catppuccin-frappe.json` | 549287–549519 |
| 4,892 | 241 | `src/cli/cmd/tui/context/theme/everforest.json` | 550454–550694 |
| 4,892 | 245 | `src/cli/cmd/tui/context/theme/vercel.json` | 554783–555027 |
| 4,850 | 237 | `src/cli/cmd/tui/context/theme/lucent-orng.json` | 553392–553628 |
| 4,822 | 118 | `src/config/tui-migrate.ts` | 567141–567258 |
| 4,816 | 130 | `src/cli/cmd/tui/routes/session/sidebar.tsx` | 570939–571068 |
| 4,809 | 144 | `src/cli/cmd/import.ts` | 530670–530813 |
| 4,788 | 104 | `src/command/template/review.txt` | 353531–353634 |
| 4,781 | 118 | `src/plugin/github-copilot/models.ts` | 359290–359407 |
| 4,752 | 132 | `src/tool/grep.ts` | 321206–321337 |
| 4,713 | 235 | `src/cli/cmd/tui/context/theme/material.json` | 551489–551723 |
| 4,702 | 221 | `src/cli/cmd/tui/context/theme/nightowl.json` | 552271–552491 |
| 4,689 | 112 | `src/cli/cmd/tui/context/theme/catppuccin.json` | 549174–549285 |
| 4,645 | 249 | `src/cli/cmd/tui/context/theme/carbonfox.json` | 555472–555720 |
| 4,640 | 233 | `src/cli/cmd/tui/context/theme/github.json` | 550934–551166 |
| 4,621 | 131 | `src/provider/sdk/copilot/responses/openai-responses-prepare-tools.ts` | 234097–234227 |
| 4,616 | 151 | `src/util/log.ts` | 80346–80496 |
| 4,586 | 233 | `src/cli/cmd/tui/context/theme/catppuccin-macchiato.json` | 549521–549753 |
| 4,581 | 129 | `src/server/routes/provider.ts` | 394484–394612 |
| 4,569 | 237 | `src/cli/cmd/tui/context/theme/flexoki.json` | 550696–550932 |
| 4,471 | 144 | `src/provider/sdk/copilot/chat/convert-to-openai-compatible-chat-messages.ts` | 232749–232892 |
| 4,454 | 147 | `src/cli/cmd/debug/agent.ts` | 524692–524838 |
| 4,425 | 142 | `src/cli/cmd/tui/component/workspace/dialog-session-list.tsx` | 563428–563569 |
| 4,416 | 105 | `src/file/time.ts` | 320404–320508 |
| 4,394 | 234 | `src/cli/cmd/tui/context/theme/rosepine.json` | 553853–554086 |
| 4,376 | 133 | `src/mcp/oauth-provider.ts` | 351853–351985 |
| 4,337 | 108 | `src/session/projectors.ts` | 398616–398723 |
| 4,332 | 218 | `src/cli/cmd/tui/context/theme/vesper.json` | 555029–555246 |
| 4,323 | 149 | `src/plugin/meta.ts` | 567405–567553 |
| 4,322 | 228 | `src/cli/cmd/tui/context/theme/cobalt2.json` | 549755–549982 |
| 4,320 | 135 | `src/config/tui.ts` | 567260–567394 |
| 4,301 | 135 | `src/control-plane/workspace.ts` | 390685–390819 |
| 4,293 | 226 | `src/cli/cmd/tui/context/theme/synthwave84.json` | 554312–554537 |
| 4,260 | 139 | `src/cli/cmd/tui/feature-plugins/home/footer.tsx` | 567906–568044 |
| 4,170 | 139 | `src/util/process.ts` | 81034–81172 |
| 4,162 | 144 | `src/server/routes/file.ts` | 393713–393856 |
| 4,148 | 135 | `src/cli/cmd/session.ts` | 580912–581046 |
| 4,137 | 154 | `src/cli/cmd/tui/component/dialog-command.tsx` | 563101–563254 |
| 4,120 | 102 | `src/cli/cmd/pr.ts` | 580809–580910 |
| 4,117 | 222 | `src/cli/cmd/tui/context/theme/palenight.json` | 553630–553851 |
| 4,113 | 119 | `src/plugin/loader.ts` | 385587–385705 |
| 4,098 | 146 | `src/project/instance.ts` | 92174–92319 |
| 4,091 | 93 | `src/cli/cmd/tui/context/theme/osaka-jade.json` | 552717–552809 |
| 4,080 | 223 | `src/cli/cmd/tui/context/theme/zenburn.json` | 555248–555470 |
| 4,063 | 80 | `src/account/repo.ts` | 161372–161451 |
| 4,031 | 221 | `src/cli/cmd/tui/context/theme/monokai.json` | 552049–552269 |
| 4,007 | 223 | `src/cli/cmd/tui/context/theme/nord.json` | 552493–552715 |
| 3,988 | 102 | `src/auth/index.ts` | 95791–95892 |
| 3,984 | 219 | `src/cli/cmd/tui/context/theme/dracula.json` | 550234–550452 |
| 3,983 | 223 | `src/cli/cmd/tui/context/theme/solarized.json` | 554088–554310 |
| 3,858 | 101 | `src/tool/websearch.ts` | 339383–339483 |
| 3,849 | 63 | `src/tool/task.txt` | 321839–321901 |
| 3,844 | 129 | `src/cli/ui.ts` | 518106–518234 |
| 3,824 | 84 | `src/cli/cmd/tui/context/theme/one-dark.json` | 552811–552894 |
| 3,744 | 77 | `src/cli/cmd/tui/context/theme/matrix.json` | 551725–551801 |
| 3,738 | 106 | `src/cli/cmd/tui/feature-plugins/sidebar/files.tsx` | 568619–568724 |
| 3,727 | 94 | `src/session/retry.ts` | 309181–309274 |
| 3,696 | 77 | `src/cli/cmd/tui/context/theme/kanagawa.json` | 551411–551487 |
| 3,663 | 120 | `src/cli/cmd/tui/ui/toast.tsx` | 556847–556966 |
| 3,592 | 77 | `src/skill/discovery.ts` | 297868–297944 |
| 3,585 | 69 | `src/command/template/initialize.txt` | 353461–353529 |
| 3,574 | 97 | `src/tool/skill.ts` | 339267–339363 |
| 3,513 | 123 | `src/cli/cmd/tui/routes/home.tsx` | 570609–570731 |
| 3,482 | 96 | `src/cli/cmd/tui/ui/dialog-confirm.tsx` | 570077–570172 |
| 3,428 | 110 | `src/cli/cmd/db.ts` | 581435–581544 |
| 3,230 | 96 | `src/tool/write.ts` | 339149–339244 |
| 3,216 | 94 | `src/cli/cmd/tui/feature-plugins/sidebar/lsp.tsx` | 568409–568502 |
| 3,203 | 87 | `src/tool/codesearch.ts` | 339501–339587 |
| 3,144 | 96 | `src/cli/cmd/tui/component/logo.tsx` | 566653–566748 |
| 3,137 | 94 | `src/tool/lsp.ts` | 339612–339705 |
| 2,952 | 156 | `src/permission/arity.ts` | 314175–314330 |
| 2,951 | 99 | `src/server/routes/project.ts` | 391558–391656 |
| 2,908 | 101 | `src/cli/cmd/tui/component/dialog-console-org.tsx` | 563869–563969 |
| 2,878 | 59 | `src/account/schema.ts` | 161312–161370 |
| 2,858 | 96 | `src/cli/cmd/tui/component/dialog-session-list.tsx` | 563331–563426 |
| 2,826 | 80 | `src/session/status.ts` | 309276–309355 |
| 2,803 | 97 | `src/util/effect-zod.ts` | 95693–95789 |
| 2,797 | 124 | `src/lsp/language.ts` | 185670–185793 |
| 2,763 | 80 | `src/config/markdown.ts` | 161068–161147 |
| 2,756 | 97 | `src/shell/shell.ts` | 314077–314173 |
| 2,701 | 75 | `src/cli/cmd/tui/feature-plugins/sidebar/context.tsx` | 568167–568241 |
| 2,670 | 93 | `src/cli/cmd/tui/routes/session/dialog-message.tsx` | 570737–570829 |
| 2,646 | 82 | `src/util/locale.ts` | 521419–521500 |
| 2,642 | 88 | `src/cli/cmd/tui/component/prompt/stash.tsx` | 564073–564160 |
| 2,642 | 80 | `src/cli/cmd/tui/component/prompt/frecency.tsx` | 564246–564325 |
| 2,610 | 102 | `src/cli/cmd/tui/win32.ts` | 548913–549014 |
| 2,578 | 71 | `src/cli/cmd/tui/ui/dialog-alert.tsx` | 565201–565271 |
| 2,576 | 109 | `src/cli/cmd/tui/context/sdk.tsx` | 557987–558095 |
| 2,573 | 68 | `src/session/todo.ts` | 322233–322300 |
| 2,570 | 63 | `src/session/session.sql.ts` | 91189–91251 |
| 2,553 | 99 | `src/cli/cmd/tui/context/keybind.tsx` | 558681–558779 |
| 2,539 | 61 | `src/cli/cmd/tui/ui/dialog-help.tsx` | 563039–563099 |
| 2,471 | 92 | `src/cli/cmd/tui/component/dialog-mcp.tsx` | 562566–562657 |
| 2,429 | 83 | `src/cli/cmd/tui/component/prompt/history.tsx` | 563976–564058 |
| 2,425 | 76 | `src/id/id.ts` | 164564–164639 |
| 2,408 | 74 | `src/tool/glob.ts` | 321119–321192 |
| 2,406 | 82 | `src/server/routes/config.ts` | 393858–393939 |
| 2,384 | 79 | `src/cli/cmd/debug/file.ts` | 524394–524472 |
| 2,381 | 54 | `src/effect/instance-state.ts` | 85579–85632 |
| 2,372 | 73 | `src/session/system.ts` | 308846–308918 |
| 2,351 | 74 | `src/tool/plan.ts` | 310612–310685 |
| 2,351 | 70 | `src/cli/cmd/models.ts` | 524181–524250 |
| 2,332 | 79 | `src/server/router.ts` | 394964–395042 |
| 2,328 | 80 | `src/cli/cmd/tui/context/theme/ayu.json` | 549093–549172 |
| 2,277 | 74 | `src/cli/cmd/export.ts` | 530595–530668 |
| 2,262 | 93 | `src/util/keybind.ts` | 558587–558679 |
| 2,262 | 76 | `src/cli/cmd/tui/feature-plugins/sidebar/todo.tsx` | 568542–568617 |
| 2,247 | 78 | `src/cli/cmd/tui/component/dialog-stash.tsx` | 564162–564239 |
| 2,225 | 99 | `src/cli/cmd/tui/util/transcript.ts` | 573347–573445 |
| 2,223 | 82 | `src/acp/session.ts` | 579135–579216 |
| 2,218 | 77 | `src/server/routes/question.ts` | 391423–391499 |
| 2,208 | 47 | `src/agent/prompt/title.txt` | 297538–297584 |
| 2,192 | 66 | `src/cli/cmd/upgrade.ts` | 523830–523895 |
| 2,152 | 75 | `src/cli/cmd/tui/attach.ts` | 577355–577429 |
| 2,145 | 74 | `src/util/error.ts` | 80959–81032 |
| 2,137 | 61 | `src/cli/cmd/debug/lsp.ts` | 524474–524534 |
| 2,128 | 76 | `src/cli/cmd/debug/ripgrep.ts` | 524536–524611 |
| 2,012 | 57 | `src/cli/cmd/web.ts` | 580751–580807 |
| 1,983 | 73 | `src/server/routes/workspace.ts` | 393957–394029 |
| 1,979 | 60 | `src/util/wildcard.ts` | 297194–297253 |
| 1,929 | 78 | `src/cli/cmd/tui/component/startup-loading.tsx` | 562487–562564 |
| 1,867 | 57 | `src/project/state.ts` | 92116–92172 |
| 1,860 | 45 | `src/cli/error.ts` | 524256–524300 |
| 1,859 | 69 | `src/cli/cmd/tui/context/theme/aura.json` | 549023–549091 |
| 1,843 | 49 | `src/cli/network.ts` | 524305–524353 |
| 1,817 | 39 | `src/provider/sdk/copilot/responses/tool/file-search.ts` | 233950–233988 |
| 1,798 | 57 | `src/cli/cmd/acp.ts` | 580690–580746 |
| 1,772 | 60 | `src/cli/cmd/tui/routes/session/dialog-fork-from-timeline.tsx` | 570878–570937 |
| 1,769 | 62 | `src/util/rpc.ts` | 577431–577492 |
| 1,768 | 52 | `src/tool/tool.ts` | 310542–310593 |
| 1,729 | 72 | `src/server/routes/event.ts` | 394614–394685 |
| 1,718 | 67 | `src/control-plane/sse.ts` | 390617–390683 |
| 1,680 | 56 | `src/server/routes/permission.ts` | 391501–391556 |
| 1,674 | 60 | `src/server/mdns.ts` | 398555–398614 |
| 1,552 | 43 | `src/provider/sdk/copilot/copilot-provider.ts` | 235619–235661 |
| 1,534 | 29 | `src/session/prompt/plan.txt` | 310484–310512 |
| 1,483 | 69 | `src/file/ignore.ts` | 319592–319660 |
| 1,464 | 56 | `src/cli/cmd/tui/feature-plugins/home/tips.tsx` | 568110–568165 |
| 1,457 | 44 | `src/global/index.ts` | 80301–80344 |
| 1,447 | 63 | `src/cli/cmd/tui/component/textarea-keybindings.ts` | 565273–565335 |
| 1,430 | 3 | `src/tool/edit.txt` | 315524–315526 |
| 1,417 | 39 | `src/provider/sdk/copilot/responses/tool/web-search.ts` | 233990–234028 |
| 1,402 | 54 | `src/provider/sdk/copilot/chat/openai-compatible-prepare-tools.ts` | 232954–233007 |
| 1,397 | 29 | `src/provider/sdk/copilot/responses/tool/image-generation.ts` | 234067–234095 |
| 1,396 | 44 | `src/cli/cmd/tui/component/spinner.tsx` | 561074–561117 |
| 1,381 | 54 | `src/cli/heap.ts` | 581727–581780 |
| 1,380 | 42 | `src/cli/cmd/tui/event.ts` | 352178–352219 |
| 1,369 | 44 | `src/cli/cmd/tui/util/editor.ts` | 564921–564964 |
| 1,362 | 37 | `src/cli/cmd/tui/component/plugin-route-missing.tsx` | 562449–562485 |
| 1,304 | 36 | `src/tool/question.ts` | 310701–310736 |
| 1,298 | 36 | `src/provider/sdk/copilot/responses/tool/web-search-preview.ts` | 234030–234065 |
| 1,277 | 46 | `src/cli/cmd/tui/routes/session/dialog-timeline.tsx` | 570831–570876 |
| 1,249 | 37 | `src/cli/cmd/tui/component/todo-item.tsx` | 568504–568540 |
| 1,238 | 57 | `src/plugin/cloudflare.ts` | 385529–385585 |
| 1,214 | 17 | `src/tool/read.txt` | 321528–321544 |
| 1,213 | 29 | `src/provider/sdk/copilot/responses/tool/code-interpreter.ts` | 233920–233948 |
| 1,213 | 53 | `src/file/protected.ts` | 315853–315905 |
| 1,195 | 45 | `src/cli/cmd/debug/snapshot.ts` | 524646–524690 |
| 1,181 | 36 | `src/tool/apply_patch.txt` | 340198–340233 |
| 1,173 | 52 | `src/cli/cmd/tui/context/exit.tsx` | 558136–558187 |
| 1,155 | 27 | `src/provider/schema.ts` | 187155–187181 |
| 1,150 | 41 | `src/control-plane/adaptors/worktree.ts` | 390548–390588 |
| 1,145 | 40 | `src/server/middleware.ts` | 394687–394726 |
| 1,141 | 35 | `src/effect/run-service.ts` | 92321–92355 |
| 1,119 | 19 | `src/config/tui-schema.ts` | 567121–567139 |
| 1,115 | 40 | `src/tool/todo.ts` | 322302–322341 |
| 1,111 | 28 | `src/session/schema.ts` | 165351–165378 |
| 1,102 | 45 | `src/cli/cmd/tui/context/kv.tsx` | 555722–555766 |
| 1,089 | 22 | `src/tool/lsp.txt` | 339589–339610 |
| 1,062 | 26 | `src/tool/batch.txt` | 321339–321364 |
| 1,055 | 29 | `src/account/account.sql.ts` | 161282–161310 |
| 1,036 | 17 | `src/tool/websearch.txt` | 339365–339381 |
| 1,007 | 38 | `src/cli/cmd/generate.ts` | 522041–522078 |
| 952 | 43 | `src/cli/cmd/tui/component/dialog-theme-list.tsx` | 562995–563037 |
| 933 | 32 | `src/tool/external-directory.ts` | 320510–320541 |
| 927 | 21 | `src/agent/prompt/explore.txt` | 297501–297521 |
| 897 | 24 | `src/provider/sdk/copilot/responses/tool/local-shell.ts` | 233604–233627 |
| 886 | 39 | `src/cli/cmd/tui/plugin/slots.tsx` | 569164–569202 |
| 872 | 24 | `src/cli/cmd/debug/index.ts` | 524840–524863 |
| 864 | 15 | `src/tool/codesearch.txt` | 339485–339499 |
| 860 | 31 | `src/cli/cmd/tui/component/dialog-skill.tsx` | 565337–565367 |
| 810 | 18 | `src/session/prompt/max-steps.txt` | 310523–310540 |
| 809 | 34 | `src/server/error.ts` | 390933–390966 |
| 808 | 16 | `src/tool/webfetch.txt` | 338935–338950 |
| 795 | 18 | `src/agent/prompt/compaction.txt` | 297482–297499 |
| 766 | 34 | `src/project/bootstrap.ts` | 399218–399251 |
| 759 | 30 | `src/bus/bus-event.ts` | 91253–91282 |
| 757 | 29 | `src/util/glob.ts` | 80050–80078 |
| 745 | 11 | `src/tool/grep.txt` | 321194–321204 |
| 732 | 32 | `src/util/context.ts` | 84013–84044 |
| 724 | 32 | `src/cli/cmd/tui/component/dialog-variant.tsx` | 561694–561725 |
| 720 | 13 | `src/tool/question.txt` | 310687–310699 |
| 705 | 14 | `src/agent/prompt/summary.txt` | 297523–297536 |
| 702 | 28 | `src/cli/cmd/tui/context/helper.tsx` | 548859–548886 |
| 699 | 16 | `src/session/overflow.ts` | 309164–309179 |
| 694 | 23 | `src/util/format.ts` | 564969–564991 |
| 684 | 29 | `src/server/projectors.ts` | 398725–398753 |
| 678 | 6 | `src/cli/cmd/tui/util/provider-origin.ts` | 561730–561735 |
| 675 | 11 | `src/tool/write.txt` | 339137–339147 |
| 649 | 17 | `src/provider/sdk/copilot/openai-compatible-error.ts` | 232936–232952 |
| 639 | 16 | `src/tool/plan-exit.txt` | 310595–310610 |
| 636 | 18 | `src/provider/sdk/copilot/responses/openai-error.ts` | 233585–233602 |
| 620 | 6 | `src/cli/logo.ts` | 518099–518104 |
| 600 | 19 | `src/cli/effect/prompt.ts` | 522979–522997 |
| 597 | 29 | `src/env/index.ts` | 95894–95922 |
| 596 | 9 | `src/tool/glob.txt` | 321109–321117 |
| 594 | 17 | `src/util/which.ts` | 91498–91514 |
| 587 | 25 | `src/cli/cmd/tui/component/dialog-agent.tsx` | 563256–563280 |
| 577 | 17 | `src/cli/cmd/serve.ts` | 524355–524371 |
| 573 | 20 | `src/cli/cmd/tui/context/plugin-keybinds.ts` | 570056–570075 |
| 548 | 24 | `src/util/queue.ts` | 390908–390931 |
| 538 | 22 | `src/util/fn.ts` | 309933–309954 |
| 537 | 16 | `src/sync/event.sql.ts` | 164547–164562 |
| 521 | 21 | `src/cli/cmd/tui/component/dialog-session-rename.tsx` | 563282–563302 |
| 480 | 20 | `src/tool/invalid.ts` | 339246–339265 |
| 476 | 13 | `src/control-plane/schema.ts` | 355387–355399 |
| 475 | 17 | `src/lsp/launch.ts` | 97331–97347 |
| 473 | 24 | `src/cli/cmd/tui/context/route.tsx` | 548888–548911 |
| 467 | 18 | `src/util/abort.ts` | 338952–338969 |
| 464 | 18 | `src/project/project.sql.ts` | 91170–91187 |
| 444 | 15 | `src/config/console-state.ts` | 393941–393955 |
| 435 | 13 | `src/tool/schema.ts` | 297265–297277 |
| 433 | 11 | `src/cli/cmd/tui/util/model.ts` | 573335–573345 |
| 428 | 15 | `src/control-plane/workspace.sql.ts` | 390601–390615 |
| 428 | 13 | `src/pty/schema.ts` | 392815–392827 |
| 420 | 20 | `src/cli/cmd/tui/util/scroll.ts` | 558781–558800 |
| 419 | 16 | `src/control-plane/types.ts` | 390531–390546 |
| 405 | 15 | `src/permission/schema.ts` | 297586–297600 |
| 402 | 17 | `src/cli/cmd/debug/scrap.ts` | 524613–524629 |
| 401 | 11 | `src/provider/sdk/copilot/chat/openai-compatible-chat-options.ts` | 232924–232934 |
| 397 | 12 | `src/project/schema.ts` | 91530–91541 |
| 396 | 13 | `src/cli/cmd/tui/util/selection.ts` | 548351–548363 |
| 393 | 15 | `src/question/schema.ts` | 309357–309371 |
| 388 | 14 | `src/share/share.sql.ts` | 355401–355414 |
| 382 | 17 | `src/provider/sdk/copilot/responses/map-openai-responses-finish-reason.ts` | 233902–233918 |
| 375 | 12 | `src/sync/schema.ts` | 164641–164652 |
| 371 | 14 | `src/cli/cmd/debug/config.ts` | 524379–524392 |
| 365 | 14 | `src/cli/cmd/debug/skill.ts` | 524631–524644 |
| 363 | 14 | `src/cli/cmd/tui/ui/link.tsx` | 561281–561294 |
| 346 | 19 | `src/cli/bootstrap.ts` | 518244–518262 |
| 343 | 9 | `src/permission/evaluate.ts` | 297255–297263 |
| 340 | 16 | `src/provider/sdk/copilot/chat/map-openai-compatible-finish-reason.ts` | 232907–232922 |
| 337 | 15 | `src/util/timeout.ts` | 185795–185809 |
| 336 | 14 | `src/effect/instance-registry.ts` | 83993–84006 |
| 335 | 21 | `src/util/lazy.ts` | 83964–83984 |
| 315 | 21 | `src/cli/cmd/tui/component/border.tsx` | 556825–556845 |
| 300 | 11 | `src/util/data-url.ts` | 353784–353794 |
| 299 | 10 | `src/util/effect-http-client.ts` | 92748–92757 |
| 299 | 8 | `src/session/prompt/build-switch.txt` | 310514–310521 |
| 295 | 13 | `src/util/schema.ts` | 91516–91528 |
| 294 | 12 | `src/util/archive.ts` | 97303–97314 |
| 269 | 18 | `src/cli/cmd/tui/context/prompt.tsx` | 566750–566767 |
| 260 | 11 | `src/util/token.ts` | 298496–298506 |
| 253 | 11 | `src/util/update-schema.ts` | 165339–165349 |
| 250 | 10 | `src/storage/db.bun.ts` | 91019–91028 |
| 249 | 10 | `src/server/event.ts` | 161271–161280 |
| 235 | 9 | `src/storage/schema.sql.ts` | 91160–91168 |
| 235 | 10 | `src/control-plane/adaptors/index.ts` | 390590–390599 |
| 232 | 11 | `src/util/hash.ts` | 94823–94833 |
| 224 | 12 | `src/cli/cmd/tui/component/prompt/part.ts` | 564060–564071 |
| 215 | 12 | `src/provider/sdk/copilot/chat/get-response-metadata.ts` | 232894–232905 |
| 200 | 10 | `src/effect/instance-ref.ts` | 85568–85577 |
| 187 | 12 | `src/cli/cmd/tui/plugin/internal.ts` | 569151–569162 |
| 186 | 7 | `src/tool/truncation-dir.ts` | 297279–297285 |
| 161 | 10 | `src/cli/cmd/tui/context/tui-config.tsx` | 555772–555781 |
| 159 | 11 | `src/util/defer.ts` | 321903–321913 |
| 155 | 5 | `src/cli/cmd/tui/util/signal.ts` | 563325–563329 |
| 128 | 4 | `src/cli/cmd/tui/component/prompt/autocomplete.tsx` | 564241–564244 |
| 124 | 6 | `src/bus/global.ts` | 83986–83991 |
| 122 | 4 | `src/cli/cmd/db.ts` | 581048–581051 |
| 121 | 8 | `src/cli/cmd/tui/context/args.tsx` | 558189–558196 |
| 120 | 7 | `src/config/tui.ts` | 567106–567112 |
| 108 | 5 | `src/cli/cmd/github.ts` | 525795–525799 |
| 107 | 8 | `src/cli/cmd/tui/plugin/runtime.ts` | 567396–567403 |
| 107 | 5 | `src/acp/agent.ts` | 579129–579133 |
| 106 | 4 | `src/util/record.ts` | 80954–80957 |
| 106 | 8 | `src/cli/cmd/tui/plugin/runtime.ts` | 567897–567904 |
| 105 | 4 | `src/cli/cmd/tui/plugin/runtime.ts` | 567101–567104 |
| 87 | 6 | `src/config/tui-migrate.ts` | 567114–567119 |
| 84 | 3 | `src/cli/cmd/run.ts` | 518090–518092 |
| 82 | 5 | `src/index.ts` | 581546–581550 |
| 79 | 4 | `src/cli/cmd/tui/ui/dialog-select.tsx` | 558582–558585 |
| 78 | 6 | `src/cli/cmd/run.ts` | 521412–521417 |
| 66 | 2 | `src/cli/cmd/tui/util/clipboard.ts` | 546448–546449 |
| 66 | 3 | `src/cli/cmd/tui/app.tsx` | 549016–549018 |
| 65 | 4 | `src/provider/sdk/copilot/index.ts` | 235663–235666 |
| 63 | 4 | `src/cli/cmd/tui/component/prompt/index.tsx` | 563971–563974 |
| 53 | 4 | `src/cli/ui.ts` | 518094–518097 |
| 53 | 2 | `src/cli/cmd/run.ts` | 518264–518265 |
| 51 | 2 | `src/cli/cmd/tui/component/dialog-model.tsx` | 561727–561728 |
| 45 | 2 | `src/installation/meta.ts` | 85565–85566 |
| 43 | 3 | `src/cli/cmd/tui/routes/session/index.tsx` | 570733–570735 |
| 42 | 3 | `src/index.ts` | 524252–524254 |
| 41 | 4 | `src/cli/cmd/cmd.ts` | 518236–518239 |
| 41 | 3 | `src/cli/cmd/tui/context/theme.tsx` | 555768–555770 |
| 41 | 3 | `src/cli/cmd/tui/routes/session/index.tsx` | 571511–571513 |
| 40 | 4 | `src/util/iife.ts` | 84008–84011 |
| 40 | 2 | `src/cli/cmd/tui/context/theme.tsx` | 549020–549021 |
| 37 | 3 | `src/cli/cmd/account.ts` | 522083–522085 |
| 36 | 2 | `src/index.ts` | 580748–580749 |
| 23 | 2 | `src/cli/cmd/serve.ts` | 524302–524303 |
| 22 | 2 | `src/cli/cmd/debug/index.ts` | 524376–524377 |
| 20 | 2 | `src/index.ts` | 524373–524374 |
| 19 | 2 | `src/index.ts` | 522080–522081 |
| 19 | 2 | `src/cli/cmd/acp.ts` | 577676–577677 |
| 16 | 2 | `src/cli/cmd/tui/component/prompt/index.tsx` | 564966–564967 |
| 15 | 2 | `src/cli/cmd/tui/component/dialog-provider.tsx` | 558579–558580 |
| 15 | 2 | `src/cli/cmd/tui/component/dialog-model.tsx` | 561691–561692 |
| 14 | 2 | `src/cli/cmd/run.ts` | 518241–518242 |

## Vendor modules by package root

| modules | bytes | package |
|---:|---:|---|
| 566 | 238,432 | `..` |
| 185 | 1,412,978 | `effect` |
| 115 | 234,077 | `openai` |
| 103 | 227,352 | `drizzle-orm` |
| 100 | 701,783 | `zod` |
| 85 | 259,873 | `ajv` |
| 84 | 479,948 | `@babel/types` |
| 70 | 45,734 | `zod-to-json-schema` |
| 61 | 74,760 | `hono` |
| 53 | 459,332 | `@mixmark-io/domino` |
| 50 | 238,432 | `@babel/core` |
| 49 | 151,190 | `@anthropic-ai/sdk` |
| 47 | 50,043 | `@opentelemetry/api` |
| 46 | 93,017 | `semver` |
| 45 | 312,077 | `@npmcli/arborist` |
| 41 | 140,363 | `@aws-sdk/nested-clients` |
| 37 | 169,184 | `google-auth-library` |
| 32 | 285,151 | `fastify` |
| 30 | 44,832 | `@sigstore/sign` |
| 30 | 117,568 | `postcss-selector-parser` |
| 30 | 96,292 | `js-yaml` |
| 29 | 274,845 | `@zip.js/zip.js` |
| 29 | 198,896 | `@babel/traverse` |
| 25 | 9,672 | `remeda` |
| 23 | 138,052 | `yargs` |
| 22 | 541,754 | `iconv-lite` |
| 22 | 44,721 | `@sigstore/core` |
| 21 | 43,756 | `@sigstore/verify` |
| 21 | 161,333 | `@babel/generator` |
| 19 | 141,424 | `minimatch` |
| 18 | 51,253 | `@tufjs/models` |
| 18 | 150,989 | `@modelcontextprotocol/sdk` |
| 18 | 1,273,025 | `@opentui/core` |
| 17 | 28,787 | `@smithy/util-stream` |
| 16 | 114,049 | `vscode-jsonrpc` |
| 16 | 15,859 | `@smithy/credential-provider-imds` |
| 15 | 39,102 | `cacache` |
| 15 | 44,179 | `pacote` |
| 15 | 14,325 | `bin-links` |
| 15 | 1,089 | `@aws-sdk/credential-providers` |
| 14 | 259,802 | `parse5` |
| 14 | 20,703 | `execa` |
| 13 | 14,034 | `@npmcli/git` |
| 13 | 62,714 | `@sigstore/protobuf-specs` |
| 13 | 28,231 | `avvio` |
| 12 | 49,818 | `pino` |
| 11 | 28,741 | `make-fetch-happen` |
| 11 | 6,558 | `@aws-sdk/token-providers` |
| 11 | 25,182 | `ret` |
| 11 | 54,196 | `find-my-way` |
| 11 | 24,678 | `bonjour-service` |
| 11 | 111,731 | `entities` |
| 10 | 291,775 | `glob` |
| 10 | 12,422 | `@smithy/eventstream-codec` |
| 10 | 12,965 | `@aws-sdk/credential-provider-ini` |
| 10 | 38,056 | `caniuse-lite` |
| 10 | 27,129 | `resolve` |
| 9 | 40,604 | `@npmcli/package-json` |
| 9 | 19,125 | `@npmcli/fs` |
| 9 | 39,767 | `minipass-fetch` |
| 9 | 38,188 | `ip-address` |
| 9 | 27,402 | `tuf-js` |
| 9 | 10,645 | `gray-matter` |
| 9 | 25,785 | `diff` |
| 9 | 15,033 | `babel-plugin-module-resolver` |
| 8 | 9,388 | `@npmcli/run-script` |
| 8 | 4,870 | `@standard-community/standard-json` |
| 8 | 31,418 | `@actions/core` |
| 8 | 6,902 | `before-after-hook` |
| 8 | 20,983 | `@babel/template` |
| 8 | 32,692 | `@babel/helper-module-imports` |
| 7 | 13,972 | `pure-rand` |
| 7 | 22,989 | `npm-registry-fetch` |
| 7 | 28,552 | `@sigstore/tuf` |
| 7 | 29,093 | `gaxios` |
| 7 | 136,363 | `@smithy/core` |
| 7 | 8,719 | `@aws-sdk/credential-provider-sso` |
| 7 | 17,792 | `braces` |
| 7 | 9,538 | `pino-std-serializers` |
| 7 | 141,476 | `fast-json-stringify` |
