# Configuration

Every setting the package reads, where the file lives, and what happens when a value is
wrong.

## The config file

```
~/.config/rpiv-ask-user-question/config.json
```

The file is optional — with no config at all, every setting takes its default. This
package only ever *reads* the file; it never creates, writes or chmods it, so its
permissions are whatever you give it.

A complete example:

```json
{
  "collapseKey": "alt+o",
  "guidance": {
    "description": "Ask the user structured questions whenever requirements are ambiguous.",
    "promptSnippet": "Ask me before guessing on anything ambiguous",
    "promptGuidelines": [
      "Batch every clarifying question into one ask_user_question call.",
      "Put your recommended option first and suffix it with (Recommended)."
    ]
  }
}
```

### Where the file is looked up

1. `$XDG_CONFIG_HOME/rpiv-ask-user-question/config.json`, if `XDG_CONFIG_HOME` is set,
   non-empty and absolute. A leading `~` is expanded first; a relative value is ignored.
   Unset or ignored, the directory falls back to `~/.config`.
2. If that file does not exist, the legacy path `~/.config/rpiv-ask-user-question/config.json`
   is read. This path deliberately ignores `XDG_CONFIG_HOME`, so an existing config keeps
   working after you set the variable.
3. Neither present: all defaults.

If the XDG-path file exists, its result wins even when it is malformed — there is no
second chance at the legacy path.

### When the file is invalid

Malformed JSON is not fatal. The loader warns on stderr and continues with defaults:

```
rpiv-config: invalid JSON at <path>, using default ({}) — <parser message>
```

Valid JSON that is not an object (a string, number, `null`, or an array) is rejected too,
falling back to defaults — but silently, with no warning. Individual keys with the wrong
type are likewise dropped back to their default without a warning.

## Settings

| Setting | What it does | Default |
| --- | --- | --- |
| `collapseKey` | Key that collapses and expands the dialog. | `"ctrl+]"` |
| `notesKey` | Key that opens the notes editor. | `"n"` |
| `guidance.description` | Full text of the tool description the model sees. Replaces the built-in default entirely — no merging. | built-in description |
| `guidance.promptSnippet` | One-line snippet describing the tool in the system prompt. | built-in snippet |
| `guidance.promptGuidelines` | List of usage guidelines given to the model. | 4 built-in guidelines |
| `visibleContextGuard.enabled` | Refuse a call whose own assistant message has no visible text (fork workaround, see below). | `false` |
| `visibleContextGuard.minChars` | Minimum summed length of the calling message's trimmed text. | `1` |

### `collapseKey`

The value uses Pi's keybinding id format: zero or more distinct modifiers from `ctrl`,
`shift`, `alt`, `super`, joined by `+`, followed by a base key. Values are trimmed and
lowercased before matching.

The base key is either a single printable character from
`a-z 0-9 _ - ! @ # $ % ^ & * ( ) | ~ \` ' " : ; , . / < > ? [ ] { } = \`, or one of the
named keys `escape`, `esc`, `enter`, `return`, `tab`, `space`, `backspace`, `delete`,
`insert`, `clear`, `home`, `end`, `pageup`, `pagedown`, `up`, `down`, `left`, `right`,
`f1`–`f12`.

Examples that work: `"ctrl+]"`, `"alt+o"`, `"ctrl+shift+h"`, `"f9"`, `"ctrl+}"`.

Set `"off"` (any casing) to disable the collapse shortcut entirely — no raw terminal
listener is registered in that case.

A spec that does not match the grammar is rejected and the default is used. This is
strict on purpose: Pi's parser takes the last `+`-separated part as the key and ignores
unknown parts, so a typo like `"ctr+]"` would otherwise silently capture every bare `]`
keypress at the terminal level.

The footer hint inside the dialog names whatever key you configure (`Alt+O to collapse`
for `"alt+o"`), as do the collapsed one-line footer and the one-shot notification shown
when the dialog is first hidden. With `"off"` the collapse hint is dropped from the
footer entirely, since no shortcut can fire.

### `notesKey`

A single character matches exactly as your keyboard types it, in any script. On a
Cyrillic layout, for example, the key that types `n` on a Latin layout types `т`, so set
`"т"`. Values are trimmed; a single character keeps its case.

Anything longer is a key spec in the `collapseKey` format, such as `"ctrl+n"` or `"alt+o"`.
In terminals that use the Kitty keyboard protocol, a modified spec like `"ctrl+n"` also
works on non-Latin layouts, because the terminal reports the key's Latin equivalent.

A spec that does not match the grammar, or that names a key the dialog already uses
(`space`, `enter`, `return`, `tab`, `escape`, `esc`, and the arrow keys), is rejected and
`"n"` is used. The notes hints in the dialog name whatever key you configure.

### `guidance.description`, `guidance.promptSnippet` and `guidance.promptGuidelines`

`guidance.description` replaces the entire built-in description Pi registers for the
`ask_user_question` tool — the text the model reads when deciding how to use it. There is
no merging: a valid value wins wholesale. It is used only when it is a non-empty string;
anything else falls back to the built-in default. Like the other guidance fields it is read
once, when the extension registers the tool, so changes take effect on the next Pi restart.

These replace the text Pi puts in the system prompt about when to reach for
`ask_user_question`. Use them to make the model ask more or less often, or to enforce a
house style for options.

`promptSnippet` is used only when it is a non-empty string. `promptGuidelines` is used
only when it is a non-empty array whose entries are all non-empty strings. Anything else
falls back to the built-in defaults. Both are read once, when the extension registers the
tool, so changes take effect on the next Pi restart.

### `visibleContextGuard`

A workaround added in this fork, not in upstream `rpiv-mono`. Claude 5.x models (Opus 5.5,
Sonnet 5.5, Fable 5/5.1, Mythos 5.1) sometimes write the explanation meant for you as a
"progress update" `thinking` block right before a tool call, instead of as text. Pi requests
summarized thinking, so you see at most a reworded thinking summary, while the model believes
you read its explanation. Before `ask_user_question` you then get questions without their
context.

The guard is off by default. In practice a refused model retried a few times, kept slipping its
text into thinking, got refused again, and then stopped using the tool altogether.

When enabled, the tool looks up the assistant message that made the call. If that message has
fewer than `minChars` characters of visible text, the questionnaire is not shown. The model
receives `error: "missing_visible_context"` and an instruction to write its context as visible
text and call again. If the message cannot be found, the call proceeds.

```json
{ "visibleContextGuard": { "enabled": true } }
```

Turns the guard on. `minChars` must be an integer of at least 1; a wrong
type or invalid value falls back to the default for that key. The settings are read on every
call. The tool schema never changes with them, so toggling the guard does not invalidate the
prompt cache.

## Environment variables

| Variable | Effect |
| --- | --- |
| `XDG_CONFIG_HOME` | Relocates the config directory, as described above. Must be absolute. |

`LANG` and `LC_ALL` influence the dialog language, but they are read by
[`@juicesharp/rpiv-i18n`](https://www.npmjs.com/package/@juicesharp/rpiv-i18n) rather than
by this package — see [localization.md](./localization.md).

No other environment variables are read. The package makes no model calls, so it needs no
API keys or model settings of its own.
