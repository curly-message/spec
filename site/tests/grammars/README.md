# Host grammars

The grammars an editor colours a catalogue with, kept here as test fixtures:
[`grammar.test.mjs`](../grammar.test.mjs) injects the grammars of
[`grammar/`](../../../grammar) into them, as an editor extension would, and
holds what comes out to the site's colouring. Nothing here is built, shipped
or served.

They are the files VS Code ships, copied unchanged from
[`microsoft/vscode`](https://github.com/microsoft/vscode) at commit
`65981f4eedef74b083aed10517abc27290fcce8f`, so the test runs against what an
editor's user has. Never edit one: to update, copy the files of a newer commit
and change the commit named here.

| File | From `extensions/` of VS Code | Upstream, as the file's `version` names it | Licence |
| --- | --- | --- | --- |
| [`json/JSON.tmLanguage.json`](./json/JSON.tmLanguage.json) | `json/syntaxes/JSON.tmLanguage.json` | [`microsoft/vscode-JSON.tmLanguage`](https://github.com/microsoft/vscode-JSON.tmLanguage) at `9bd83f1c252b375e957203f21793316203f61f70` | MIT: [`json/LICENSE`](./json/LICENSE) |

VS Code converted each file from its upstream to the form it ships, and is
itself under the MIT licence: [`LICENSE-vscode.txt`](./LICENSE-vscode.txt).
