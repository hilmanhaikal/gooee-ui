# Changelog

What changed in Gooee UI for people who use it: components, blocks, templates, themes, tokens and the `npx gooee add` command. Newest first.

## 1.6.1 · November 2026

New docs demos for 1.6.0, a ButtonGroup that keeps one outline, and a bigger tap area on Table's row button.

### Added

- Docs: seven demos for 1.6.0, in React and Vue, each with a guide. Select with groups and icons, Combobox with every time zone, MultiSelect fed by a server, DropdownMenu with checks, choices and a submenu, AlertDialog that waits for the server, Table rows that open, and DataGrid loading 240 orders 30 at a time.

### Fixed

- ButtonGroup: hovering or pressing a button no longer breaks the group's outline. The soft edge read only the top-left corner, so the first button drew round on all four sides and the last one square, and its edge moved off the shared border. It now follows each corner, and inside a group hover and press change the fill only. An IconButton in a group no longer shrinks on press.
- Button: the soft edge sits on the button's exact size. It used whole pixels, so a 127.4px button drew a 127px edge.
- Table: with `onRowAction`, the row button in the first column is now as tall as the row to tap, at least 44px. It was only as tall as its text, about 24px. The row looks the same.

## 1.6.0 · November 2026

Deeper parts for real apps: server-fed grids, option lists in the thousands, one menu model, async confirm, close reasons, and right-to-left pages.

### Added

- DataGrid: `loadError` shows in place of the rows when they fail to load, is announced, and `onRetry` (`@retry` in Vue) adds a Try again button.
- Dialog: `onOpenChange` gets a second argument, the reason it closed: `escape`, `outside`, `close-button` or `drag`. In Vue, listen with `@close`.
- AlertDialog: `onConfirm` (`@confirm` in Vue) can return a promise. The dialog waits with a spinner on the button, Cancel and Esc wait too, and it closes once the promise succeeds. If it fails, the dialog stays open. `confirmingLabel` names the wait for screen readers.
- Select: `clearable` adds "None" as the first row, so a choice can be taken back. In React, `onClear` is called; in Vue, `v-model` becomes `null`.
- DataGrid for server data: `total` sets the row count and what screen readers hear when `rows` holds only some rows. `rowOffset` gives a later page its real row numbers.
- DataGrid: `onLoadMore` (`@load-more` in Vue) asks for more rows when the user scrolls or keys to the end. `loadingMore` shows a loading row while they come, and `hasMore` says when to stop (by default, once `total` is reached).
- DataGrid and Table: `onRowAction` (`@row-action` in Vue) opens a row on a click. In DataGrid, Enter on a cell with no controls does the same. In Table, the first column's text becomes a button for keyboard and screen reader users.
- DataGrid: `empty` (the `#empty` slot in Vue) replaces the "No rows" message, such as with a button to add the first row.
- Select, Combobox and MultiSelect handle long lists: past 100 options, only the options in view are drawn, so a list of thousands opens and scrolls fast. Keys, type-ahead and screen readers still reach every option.
- Select, Combobox and MultiSelect: an option's `group` puts it under a named group. Options of a group show together, and a screen reader says the group's name.
- Select, Combobox and MultiSelect: `renderOption` (the `#option` slot in Vue) draws an option's content, such as an icon or an avatar before the label.
- MultiSelect can load its options from a server, as Combobox does: `inputValue` and `onInputChange` (`v-model:input-value` in Vue), `filter={false}`, `loading`, `loadError` and `onRetry` (`@retry`).
- DropdownMenu and ContextMenu take the same entries as Menubar: `checkbox` items, `radio` groups and submenus (`items` on an item; ContextMenu had them already). Clicking a checkable item closes the menu; Space keeps it open, so several can be set in a row.
- DropdownMenu and ContextMenu: `href` makes an item a real link, so Cmd-click and a middle click open it in a new tab.
- Calendar, DatePicker, DateRangePicker, CalendarHeatmap and WeekSchedule: `weekStartsOn` takes any day from 0 (Sunday) to 6 (Saturday), or `'locale'` for the locale's own first day, such as Saturday in many Arabic locales. Monday stays the default.
- DataGrid: `locale` sets the sort order and the filter value lists, such as `'sv'`, where Ö comes after Z. `'en-MY'` stays the default.
- Toasts: F6 moves focus to the toasts and F6 again goes back.

### Fixed

- Toast: a toast with an action no longer closes by itself after 5 seconds, so no one loses the chance to press Undo (WCAG 2.2.1). Pass `duration` to close it anyway.
- MultiSelect: a chip keeps the label it was picked with after `options` changes, such as a server search that no longer returns it. It used to show the raw value.
- DropdownMenu: items under a label are a group named by that label, so a screen reader says the group before its first item. A disabled item's reason is read with it.
- ContextMenu and Menubar: a label names the items under it as a group too, as in DropdownMenu.
- Menus on a right-to-left page: Left opens a submenu and Right closes it, the Menubar's arrows follow the reading order, and a submenu opens to the left with its arrow pointing there.
- DropdownMenu and ContextMenu: once a menu has a checkable item, every label lines up in the same column, as in Menubar.
- ContextMenu: a submenu opened by key or click no longer closes by itself when a hover from just before is still waiting to act.
- Dialog, AlertDialog, Sheet, Drawer, CommandPalette and Lightbox make the page behind them inert while open, so a screen reader cannot wander behind a modal. Toasts and live announcements stay reachable.
- Toasts: when the toast that holds focus leaves, focus moves to the next toast or back where it came from, instead of being lost.
- Right-to-left pages: arrow keys follow the reading order in Tabs, Calendar and DataGrid. DataGrid and Table mirror, with the pinned or first column at the right, and a DataGrid column edge drags the right way. The Calendar's month arrows point the right way.
- Combobox and MultiSelect: the search ignores accents, so "cafe" finds "Café", and the underline marks the right letters.

## 1.5.1 · November 2026

KanbanBoard scrolls when a card is held at its edge, and a small Dialog stacks its buttons.

### Changed

- Docs: two page headers, down from five. Block and theme pages open like a part's page, with the group and tier above a large name. Guides, Tokens and What's new share one quieter title, each with a breadcrumb.

### Fixed

- KanbanBoard: a card held at the left or right edge now scrolls the board, in React and Vue. The board's column snap used to pull every step back, so it never moved. After the drop the board settles on the nearest column.
- Dialog: a small dialog (`size="sm"`) stacks its actions at full width, the main one on top. Side by side they fitted by a few pixels only, so a denser theme or a longer word wrapped them into two uneven rows.
- Docs: a framed preview no longer grows without end when its page is taller than its own window. The Glass theme page had reached 16,000px.
- Docs: on a phone or tablet, search opens at the top of the screen, with the field first and the results under it. It used to sit at the bottom, where the keyboard covered it, the results would not scroll and the page could stay shifted.
- Docs: in the phone menu, one fill slides between Docs, Components, Blocks and Resources. It used to jump.

## 1.5.0 · November 2026

ScrollArea's thumb is a drop now: it stretches with scroll speed and squashes when it lands on an end.

### Highlights

- **ScrollArea** has a gooey thumb in React and Vue, 44px wide to grab.
- **A new homepage**: Gooee beside the headline, and the site's four places as one row of huge words.
- **Docs pages** are one surface, edge to edge, with fewer lines and bigger names.

### Added

- Homepage: Parts, Blocks, Docs and Tokens as one row of huge words with real counts. A drop of Gooee comes out of its side and flows to the word you point at or focus. A click or Enter opens it; on a touch screen the first tap shows it and the second opens it.
- Homepage: Gooee answers what you do, in words: it watches the pointer, drops a bead when you copy, and melts after a quiet while. Your local time sits beside it.
- A footer on every page: the command to add a part, links in three groups, real counts, the version and its month, and Gooee melting into a puddle at the end.
- The page has its own scrollbar on a mouse or trackpad: the same gooey thumb as ScrollArea. Touch screens and forced colours keep the browser's bar.

### Changed

- ScrollArea: the thumb stretches longer and thinner with scroll speed, squashes against the end it lands on, and settles back round. At rest it looks as before. Its hit area is 44px across. With reduced motion it does not stretch or squash.
- Docs: no black frame round the page, in light and dark. The top bar, the sidebar and the bottom bar sit on the page.
- Docs: the current page in the sidebar and the current section in "On this page" have a plain fill that does not move. A page change never shows it on two rows.
- Docs: no outlines on the install box, code boxes and demos, and no rules between sections. A part's name is larger and calmer.
- The bottom bar shows a plain page name, not a button, on a page with no sections.
- Text wraps more evenly. Titles, labels and captions keep lines of about the same length (`text-wrap: balance`), and running text no longer ends on a single word (`text-wrap: pretty`). This is in `base.css` and in the parts that show text: Alert, Card, Dialog, Drawer, EmptyState, Sheet, Toast and others. Browsers without it wrap as before.
- IcInput: the default help text keeps "12 digits" on one line.
- Docs: a number stays on the same line as the word after it, such as "14 days" or "2 decimals", and no description, list item or What's new entry ends with one word alone on its last line.
- Docs: the TableOfContents demo puts the contents under the article on a phone, where the article used to shrink to one word per line.

### Removed

- The old homepage, its grey sheen and the old one-row footer.
- The Upgrade to 1.0 guide, since there were no users before 1.0. `/upgrade` now opens the Introduction.
- Versions before 1.0.0 from this list, and the old name. 1.0.0 is the first public version.

## 1.4.0 · November 2026

Image, Lightbox, ImageCropper, VideoPlayer and NotificationInbox are free now, with their blurred previews.

### Highlights

- **Five parts are free**: Image, Lightbox, ImageCropper, VideoPlayer and NotificationInbox.
- **Blurred previews** while photos load are now in the free package.
- **NotificationBell** shows its full count in Vue too.

### Changed

- Image, Lightbox, ImageCropper, VideoPlayer and NotificationInbox (with NotificationBell) moved from Pro to free. `npx gooee add` copies them, in React and Vue. Gooee now has 77 free parts and 75 Pro.

## 1.3.0 · November 2026

Photos can show a blurred preview while they load, in Lightbox, ImageCropper and VideoPlayer.

### Highlights

- **Lightbox** shows a blurred preview while each photo loads.
- **ImageCropper** and **VideoPlayer** can show one too.
- **Docs**: the React and Vue switch only shows where it changes something.

### Added

- Lightbox: `placeholder` on each image, a tiny image (usually a data URL). It shows blurred in the gallery thumbnail and in the viewer until the photo loads, then fades. New slot `lightbox-placeholder`.
- ImageCropper: `placeholder`, shown blurred in the crop frame until the photo loads. New slot `image-cropper-placeholder`.
- VideoPlayer: `posterPlaceholder`, shown blurred until the `poster` loads. New slot `video-player-poster-placeholder`.

### Changed

- The docs demos load their photos from gooee.dev, not from Picsum, and show a blurred preview while they load. The photos are still from Unsplash.
- Avatar and AvatarGroup demos show real photos instead of a face drawn in code. React and Vue use the same three.
- The React and Vue switch shows only on pages that change with it: components, Introduction, Installation and Forms.
- Block and template pages say they are React only for now. Theme pages say they are plain CSS and work with both.
- Introduction shows the Vue setup, the real output of the add command, and file names on each code block.
- What's new has a place in the sidebar, under Resources, and `/whats-new` opens it.
- "Motion without React" is now "Motion on its own", and the Tokens section "Without React" is now "Without the components", since Vue has its own components.
- Only versions that reach npm are listed here. Docs, tools and notes changes wait under "Unreleased" and ship with the next version.
- EventPage: the two roads on the map placeholder carry a note saying their angle draws the streets, so the design scan no longer flags them as tilted decoration.

### Fixed

- NotificationBell (Vue): the count badge was still cut in half, because the Badge's own styles won when they loaded last. The bell's rules now win in any load order.
- Lightbox and VideoPlayer: if the photo or poster fails to load, the blurred preview goes away instead of staying.
- Component pages: counts say "1 slot", "1 prop" and "1 note", not "1 slots".
- Pro pages no longer show a source folder you cannot get. Free pages say where the code lands after add.
- Glass lens: its page has an API section, which says it takes no props.
- Theming said `npm run add`; the command is `npx gooee add`.
- The script that copies the free parts to the public repo runs on Windows. It started TypeScript through `npx`, which Windows cannot start that way. It now runs TypeScript through Node directly.

## 1.2.0 · November 2026

Components, blocks and templates now share the same five screen breakpoints.

### Highlights

- **Five breakpoints** everywhere: phone, tablet, laptop, desktop and wide.
- **NotificationBell** shows its full count again.
- **What's new** shows highlights, grouped by month.

### Changed

- Components, blocks and templates switch layout at the five breakpoints: phone up to 599px, tablet from 600px, laptop from 900px, desktop from 1280px and wide from 1600px. Before, they switched at 15 different widths (420px to 1080px). So a layout may now change a little earlier or later than before. For example, side panels in blocks and templates now fold at 899px, not 768px, and the Schedule side panel shows from 1280px. The Schedule block keeps one extra rule below 360px for the smallest phones. The same widths apply in JavaScript: Dialog's drag to close, DatePicker's sheet, Tour, TeamMembers and DateRangePicker's two months.
- What's new shows each version's summary and up to three highlights. Breaking changes get their own line, and the full list opens under "All changes". Each version in this file now starts with a short `### Highlights` section.
- What's new groups versions by month, and this file gives each version its month.
- The docs site uses five breakpoints: phone (up to 599px), tablet (600px), laptop (900px), desktop (1280px) and wide (1600px). Before, pages switched at 17 different widths. On a wide screen, the page and "On this page" now sit in the middle of the sheet. DESIGN.md lists the five.

### Fixed

- NotificationBell: the count badge was squeezed to the width of the bell icon, so "3" was cut in half. It is now a round 20px badge that grows for "99+".
- DataGrid demo: the Freight and Charge (RM) headers were cut off. Their columns are now 8px wider.
- Tokens: the motion demo showed "NaNms" for every duration, and cut off the longer token names. It now shows each real time (0ms with reduced motion on) and the full names and easing curves.
- The Docs and Resources menus: descriptions used the body text's line height, so their lines sat far apart. They are now set for their own size, with the title close to its description.
- What's new: the breaking changes triangle sits on the text line, and its link uses the docs link style.
- On a 320px phone, the bottom bar was wider than the screen. It now keeps a margin on both sides, and the page name shortens first.

## 1.1.0 · November 2026

Every field now works in real forms, with form libraries and server actions, plus a new Form part.

### Highlights

- **Form** shows server errors under each field, by name.
- **About 30 fields** work with plain forms, react-hook-form, vee-validate and server actions.
- **DatePicker** says why a date can't be picked.

### Added

- **Form** (new, free, React and Vue). `<Form errors={{ email: 'Already taken' }}>` shows each error under its field by name, and the error goes as soon as that field changes. `validationBehavior="native"` uses the browser's checks; `"aria"` only marks fields and never blocks. It works with a React 19 action and `useActionState`, and after a failed submit it moves focus to the first field with an error.
- **About 30 fields join a form fully**, in a plain form, with react-hook-form and zod, and with vee-validate and zod: the value is in the form data under `name`, `required` and `readOnly` work, `ref` reaches the field (Vue exposes `el`), `onBlur` fires when focus leaves the whole field, and a form reset or a value set by code (`reset()`, `setValue()`, `defaultValues`, autofill) redraws it.
- **Fields with many values** (CheckboxGroup, MultiSelect, TagInput) send every value; FileUpload sends the real files and a reset clears them.
- **Every field shows the browser's own message** (required, pattern, min, max) under it, in Gooee's style, after a submit attempt or after a blur once edited. Which message shows: the field's own `error`, then the Form's error for its name, then the browser's.
- **Switch** sends through a hidden checkbox (new `value`, `required`, `readOnly`, `error`, `inputRef`). Its `ref` stays on the button, so with react-hook-form pass `inputRef` for the Switch only.
- **Toggle, ToggleGroup and SegmentedControl** join a form when given a `name`.
- **RichTextEditor**: `name` (sends the HTML), `error`, `required`, `readOnly`, `disabled`.
- **DateRangePicker**: `startName` and `endName`.
- The Forms guide shows plain forms, react-hook-form with zod, vee-validate with zod (Vue), and server answers with Form, live with copyable code.

### Changed

- **DatePicker and DateRangePicker say why a day cannot be picked**: "Pick today or a later date.", "Pick {min} or a later date.", "Pick {max} or an earlier date.", or your own reason when `isDateDisabled` returns a string. New labels `beforeMin`, `beforeToday` and `afterMax`.
- **CurrencyInput, PhoneInput, IcInput and AddressFields stop a plain form from being sent while their own check fails** (a wrong phone number, an empty required address). Before, the form sent the bad value. In a Form with `validationBehavior="aria"` nothing is blocked.

### Fixed

- Checkbox, Switch, Select and the other fields now follow a form reset. Before, the drawn tick, switch or choice kept the old value while the form sent the new one.
- Vue Input and InputGroup without `v-model` lost the typed text when they re-rendered.
- SearchInput: the clear button and Esc now fire a real change event. PasswordInput and SearchInput no longer fire `onBlur` when focus moves to their own button.
- Combobox no longer turns an empty value into `null`. RangeSlider and DateRangePicker no longer send their values while disabled.
- Vue MentionInput: a form reset went back to the last text instead of the first.

## 1.0.1 · November 2026

Three fixes for long lists, dates typed on a phone and checkboxes in form libraries.

### Highlights

- **Select and menus** show every option at once in a long list.
- **DatePicker** takes a date typed as digits only, on iPhone too.
- **Checkbox and Slider** work with react-hook-form's `register`.

### Fixed

- Select, DropdownMenu, ContextMenu, Menubar and MentionInput: in a long list, each option waited longer to appear than the one before it. Option 100 took about two seconds, so a Select opened on a choice near the end (a country list) looked empty. No option now waits longer than the 13th, like Combobox and MultiSelect.
- DatePicker and DateRangePicker: a date could not be typed on an iPhone. Its number pad has no "/", and the field needed one. Digits alone now work in the locale's order: 23112026 or 231126, and 16 or 12 digits for a range. The separators appear as you type, so the field shows 23/11/2026.
- Checkbox and Slider (React): an `onChange` from a form library, such as react-hook-form's `register`, replaced the part's own, so the box stayed stuck. SearchInput ignored it. Each now updates first, then calls your `onChange` with the change event.

## 1.0.0 · November 2026

The first public version, with names, tokens and styling hooks you can rely on.

### Highlights

- **Every part** has styling hooks: `data-slot` and one set of state attributes.
- **Cascade layers** let your CSS and Tailwind win without `!important`.
- **Every part with fixed text** takes one `labels` prop.

### What 1.0 promises

- From now on, a rename or removal of a part, prop, token, CLI flag or styling hook needs 2.0.
- `src/icons` and the tokens are public. `src/internal` may change in any version.

### Added

- React 19 and Vue 3.5 parts you copy into your app with `npx gooee add <name>`, plus gooee-mcp, gooee-motion and gooee-tokens. They need Node 20 or later. Cascade layers need Chrome 99, Safari 15.4 or Firefox 97.
- Vue: a plain `v-model` on Checkbox, Switch, Toggle and Tag. `valueCommit` events on Dial, RulerScrubber, PickerWheel, TimeWheel, DateWheel, Slider, RangeSlider, CompareSlider and TimePicker. A Button in Collapsible's `#trigger` slot is wired for you, like Popover.
- Pagination: `variant="compact"` shows "Page 5 of 12" over a line that fills. Tap the number to type a page in a "Go to page" field. The row of page numbers is the default, in React and Vue.
- `onValueCommit` on Slider, RangeSlider, CompareSlider, TimePicker, Dial, RulerScrubber, PickerWheel, TimeWheel and DateWheel. It fires once, when the value comes to rest.
- A `labels` prop on every part that has fixed text, with an exported type such as `DialogLabels`. Pass only the keys you change.
- `data-slot` on the root and inner pieces of every part, and one set of state attributes (`data-state`, `data-status`, `data-selected`, `data-highlighted`, `data-disabled`, `data-orientation`). Every part page has a Styling section that lists them.
- Every library stylesheet is in a cascade layer (`@layer`), so your CSS and Tailwind utilities win without `!important`.
- The CLI saves your framework in `gooee.json`. It warns when a changed shared file is used by other installed parts, and offers to update them. A `--react` option.
- Icons are public, in `src/icons`.
- The Styling hooks guide, in Theming: slots, state attributes and how to combine them.
