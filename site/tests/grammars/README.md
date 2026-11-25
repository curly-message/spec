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
| [`yaml/yaml.tmLanguage.json`](./yaml/yaml.tmLanguage.json) | `yaml/syntaxes/yaml.tmLanguage.json` | [`RedCMD/YAML-Syntax-Highlighter`](https://github.com/RedCMD/YAML-Syntax-Highlighter) at `c42cf86959ba238dc8a825bdd07bed6f5e97c978` | MIT: [`yaml/LICENSE.md`](./yaml/LICENSE.md) |
| [`yaml/yaml-1.0.tmLanguage.json`](./yaml/yaml-1.0.tmLanguage.json) | `yaml/syntaxes/yaml-1.0.tmLanguage.json` | [`RedCMD/YAML-Syntax-Highlighter`](https://github.com/RedCMD/YAML-Syntax-Highlighter) at `0b50d9c47145df62c4461c4407698a24e8f1f3c2` | MIT: [`yaml/LICENSE.md`](./yaml/LICENSE.md) |
| [`yaml/yaml-1.1.tmLanguage.json`](./yaml/yaml-1.1.tmLanguage.json) | `yaml/syntaxes/yaml-1.1.tmLanguage.json` | [`RedCMD/YAML-Syntax-Highlighter`](https://github.com/RedCMD/YAML-Syntax-Highlighter) at `dfd7e5f4f71f9695c5d8697ca57f81240165aa04` | MIT: [`yaml/LICENSE.md`](./yaml/LICENSE.md) |
| [`yaml/yaml-1.2.tmLanguage.json`](./yaml/yaml-1.2.tmLanguage.json) | `yaml/syntaxes/yaml-1.2.tmLanguage.json` | [`RedCMD/YAML-Syntax-Highlighter`](https://github.com/RedCMD/YAML-Syntax-Highlighter) at `53d38bbc66b704803de54ffce5b251bf97211c60` | MIT: [`yaml/LICENSE.md`](./yaml/LICENSE.md) |
| [`yaml/yaml-1.3.tmLanguage.json`](./yaml/yaml-1.3.tmLanguage.json) | `yaml/syntaxes/yaml-1.3.tmLanguage.json` | [`RedCMD/YAML-Syntax-Highlighter`](https://github.com/RedCMD/YAML-Syntax-Highlighter) at `274009903e20ac6dc37ba5763fb853744e28c9b2` | MIT: [`yaml/LICENSE.md`](./yaml/LICENSE.md) |
| [`yaml/yaml-embedded.tmLanguage.json`](./yaml/yaml-embedded.tmLanguage.json) | `yaml/syntaxes/yaml-embedded.tmLanguage.json` | [`RedCMD/YAML-Syntax-Highlighter`](https://github.com/RedCMD/YAML-Syntax-Highlighter) at `c42cf86959ba238dc8a825bdd07bed6f5e97c978` | MIT: [`yaml/LICENSE.md`](./yaml/LICENSE.md) |

The six YAML files are one grammar: `yaml.tmLanguage.json` is `source.yaml`,
which includes the others.

VS Code converted each file from its upstream to the form it ships, and is
itself under the MIT licence: [`LICENSE-vscode.txt`](./LICENSE-vscode.txt).
