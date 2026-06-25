# Odoo 16 → 18 migration notes — Password Manager

This documents the conversion of `odoo_password_manager` from Odoo 16.0 to Odoo 18.0.

The backend (Python + XML + data) changes are high-confidence and were syntax/well-formedness
checked. The OWL/JavaScript layer had deep framework rewrites between 16 → 17 → 18; the mechanical
parts were converted with confidence, but the custom **kanban** stack and the **portal frontend**
mounting need to be exercised in a running Odoo 18 instance (see "Needs verification" below).

---

## 1. Manifest (`__manifest__.py`)
- `version` `16.0.1.2.15` → `18.0.1.2.15`.
- `website` and `live_test_url` version strings `16.0` → `18.0`.

## 2. Python models
- **`password_access.py`** — `self.clear_caches()` → `self.env.registry.clear_cache()` (the old
  helper was removed in Odoo 17).
- **`password_node.py`**
  - `name_get()` removed in Odoo 17 → reimplemented as `_compute_display_name()` (recursive
    parent path). Intentionally **no `@api.depends`** because this abstract model does not own the
    `name`/`parent_id` fields; declaring them would break registry setup.
  - `_check_recursion()` (removed in Odoo 17) → `_has_cycle()` (note: inverted semantics — it
    returns `True` when a cycle exists, so the `if` was flipped).
- **`password_key.py`**
  - `from werkzeug import urls` / `urls.url_parse(...)` → `from urllib.parse import urlsplit` /
    `urlsplit(...)` (`werkzeug.urls.url_parse` was removed in werkzeug 3 / Odoo 18). `.replace()`
    → `._replace()`, `.to_url()` → `.geturl()`.
  - Removed the `_generate_order_by()` override. That ORM hook no longer exists in Odoo 17/18 (the
    query builder was rewritten around the `SQL` / `_order_field_to_sql` API). The original was also
    buggy (referenced a non-existent `"value"` column and had a tautological `if`). Ordering now
    relies on the model's `_order = "name ASC, id"`. **Behaviour change:** the name sort is no longer
    forced to lower-case, so it follows the PostgreSQL default collation. If case-insensitive sort is
    required, re-implement via `_order_field_to_sql` wrapping the field in `LOWER(...)`.
  - `mail.activity.action_done()` → `action_feedback()` (stable public API across 16/17/18 to mark
    an activity done).
- **`portal_password_key.py`** — removed the `_generate_order_by()` override (same reason as above).

No changes were needed to the encryption/crypto logic (`password_bundle.py`,
`portal_password_bundle.py`) — those APIs (passlib, cryptography/Fernet, PBKDF2) are unaffected.

## 3. XML views
- `attrs="{...}"` (removed in Odoo 17) → inline `invisible` / `readonly` / `required` Python
  expressions in: `password_key.xml`, `password_bundle.xml`, `portal_password_bundle.xml`,
  `res_config_settings.xml`, `wizard/share_portal_password.xml`.
- `<tree>` → `<list>` and `view_mode` `tree,form` → `list,form` (Odoo 18 list-view rename) in:
  `password_bundle.xml` (inline access list), `password_tag.xml`, `portal_password_bundle.xml`,
  `wizard/odoo_password_merge.xml`.
- Kanban card template `t-name="kanban-box"` → `t-name="card"` (Odoo 18 rename) in
  `password_key.xml` and `password_bundle.xml`.
- `password_bundle.xml` — the two Extra-Security form buttons used `context="{'default_bundle_id':
  active_id}"`. Odoo 18's stricter view validation rejects `active_id` inside a **form** view (it's
  only valid in action contexts) → changed to `id` (the current record). The `active_id`/`active_ids`
  in the `password_key_action` act_window context/domain are valid and were left as-is.
- `res_config_settings.xml` — **rewritten** for the Odoo 17/18 settings-view structure. The base
  `res.config.settings` form no longer contains `<div class="settings">`, so the old
  `xpath expr="//div[hasclass('settings')]"` + `app_settings_block` / `o_setting_box` /
  `o_setting_left_pane` markup raised `ParseError: cannot be located in parent view`. Now uses
  `xpath expr="//form" position="inside"` with the `<app>` / `<block>` / `<setting>` tags. Custom
  Fields apps link `16.0` → `18.0`.

## 4. Data files
- **`data/cron.xml`** — removed `<field name="numbercall">` and `<field name="doall">` from both
  `ir.cron` records (both fields were removed from `ir.cron` in Odoo 17).
- `data/data.xml` (server actions) and `data/mail_data.xml` (activity type + mail template, already
  using `t-out`) required no changes.

## 5. JavaScript / OWL — mechanical changes (high confidence)
Applied across `static/src`:
- `const { ... } = owl;` (the `owl` global was removed in Odoo 17) → `import { ... } from "@odoo/owl";`.
- `_lt` (removed in Odoo 17; `_t` is now lazy) and `this.env._t` → `import { _t } from
  "@web/core/l10n/translation"` and `_t(...)`.
- `_.each(...)` (underscore/lodash global removed) → native `.forEach` / `Object.values(...).forEach`.
- `useService("rpc")` / `this.rpc({model, method, args})` (the rpc *service* was removed in Odoo 18):
  - backend export call → `import { rpc } from "@web/core/network/rpc"`.
  - model-method calls → the `orm` service (`this.orm.call(model, method, args)`).
- Field components: `this.props.value` (removed in Odoo 17) → `this.props.record.data[this.props.name]`
  in both JS (`password_copy_field.js`) and the QWeb templates (`password_copy_field.xml`,
  `password_duplicates.xml`).
- jQuery removed from the backend bundle:
  - `$(event.target).closest(...)` → `event.target.closest(...)`; `$("#id")[0]` →
    `document.getElementById(...)`; `$(".sel").click()` → `document.querySelector(".sel")?.click()`.
  - `$.Deferred()` in `checkBundleSecurity` → native `Promise`. `copy2ClipboardWithPopover` now takes
    a plain DOM element instead of a jQuery object.
- The `user` service was removed in Odoo 17 → `import { user } from "@web/core/user"` and `user.context`
  (`password_search_model.js`).
- **Custom field widgets registered the Odoo 18 way**: the registry now stores descriptor objects, not
  bare component classes. `PasswordCopy` and `PasswordDuplicates` are now registered as
  `{ component, extractProps, supportedTypes, ... }`. Their custom `<field>` attributes
  (`password_link`, `password_small`, `log_in`) were moved into `options="{...}"` in the XML and are
  read from `fieldInfo.options` in `extractProps` (Odoo 17/18 no longer forwards arbitrary `<field>`
  attributes to widgets). The standard `password="True"` masking attribute was kept as-is.
- `res.config.settings` view rewritten to `<app>`/`<block>`/`<setting>` (see §3).
- `model.rootParams.context` (pre-17) → `model.config.context` in the kanban renderer and the
  PasswordManager/PasswordPreview/jsTree components — **verify** (part of the kanban model rework, §6a).

## 6. JavaScript / OWL — structural changes that NEED VERIFICATION in a live Odoo 18 instance
These compile/import correctly but rely on internals that were rewritten; test them with the app
running and iterate as needed.

### a) Custom kanban stack (`static/src/views/kanban/*`, `bundle_kanban/*`)
The pre-17 kanban model classes were removed when the relational model was unified:
- `KanbanModel` → `RelationalModel` (`@web/model/relational_model/relational_model`).
- `KanbanModel.Record` → `Record` (`@web/model/relational_model/record`).
- `KanbanDynamicRecordList` → `DynamicRecordList` (`@web/model/relational_model/dynamic_record_list`).
- `KANBAN_BOX_ATTRIBUTE` → `KANBAN_CARD_ATTRIBUTE` (`@web/views/kanban/kanban_arch_parser`).

Imports/base classes were updated, but the **custom multi-record selection + clipboard feature**
(`model.selectedRecords`, `record.toggleSelection(...)`, `record.resId`, `model.notify()`, the
custom `PasswordKanbanRecord` template re-wrapping the card) was built on the Odoo 16 kanban API.
This is the highest-risk area and almost certainly needs hands-on rework against the Odoo 18
`RelationalModel`/kanban renderer. Each affected file has an `ODOO 18 MIGRATION` comment.

### a2) Kanban card template helpers/globals (`password_key.xml`, `password_bundle.xml` arches)
The Odoo 16 kanban template helpers were removed from the Odoo 18 card render context:
- `kanban_color(record.color.raw_value)` (threw `kanban_color is not a function`) → inline class
  `oe_kanban_color_#{record.color.raw_value}`. **Verify the color SCSS class prefix** in your build
  (`oe_kanban_color_N` vs `o_kanban_color_N`); if wrong, the card just shows no color (no crash).
- `user_context.uid` (no longer in the card context) → `__comp__.pwmUserId`, a getter added to
  `PasswordKanbanRecord` returning `user.userId`. Confirm `__comp__` resolves to the record component
  in your build's kanban card template.
- Still pending (cosmetic, non-crashing): the old `<ul class="oe_kanban_colorpicker" data-field="color"/>`
  and the `o_kanban_card_manage_pane` / `o_kanban_manage_toggle_button` "manage" menu are the Odoo 16
  kanban dropdown structure; rework to the Odoo 18 `<t t-name="menu">` / KanbanColorPicker if you need
  the color-picker/manage menu to work.

### b) Custom field widget (`password_copy_field.js`) — converted, light verification
Registration, `extractProps` signature, and the move of custom attributes to `options` were done
(see §5). Confirm that `charField.extractProps` in your Odoo 18 build still derives `isPassword`
from the `password` attribute, and that `model.config.context` is the correct path for the model
context used by `_onOpenRecord`/`needFormClose` flows.

### c) `record.save(...)` options (`password_duplicates.js`, login dialog)
The `save({ stayInEdition, noReload })` options changed across versions — confirm the save calls
behave as intended.

### d) Portal frontend (`static/src/js/vault_login.js`)
- `web.public.widget` → `@web/legacy/js/public/public_widget`; `_rpc(...)` →
  `rpc("/web/dataset/call_kw", {...})`.
- `OwlCompatibility.ComponentWrapper` was **removed** in Odoo 17. Replaced with `attachComponent`
  from `@web/legacy/utils` to mount the `PortalPassword` OWL component from the public widget —
  **verify this helper/signature exists in your Odoo 18 build**; otherwise use the build's current
  public-widget → OWL mounting approach.
- The jQuery Bootstrap `.popover()` plugin is gone (Bootstrap 5). Rewrote `_showPopover` to use the
  native `Popover` class — confirm how Bootstrap's `Popover` is exposed on the frontend in your build.

### e) QWeb template inheritance names + `owl="1"`
Several OWL templates inherit core templates: `t-inherit="web.KanbanRenderer"`, `web.KanbanView`,
`web.CharField`, `web.FormView.Buttons`, plus the `owl="1"` attribute on `<t t-name>`. The
`owl="1"` attribute is obsolete in Odoo 17+ (harmless, can be dropped). Confirm the inherited
template names and the xpath targets (`//Layout`, `o_kanban_renderer`, `o_form_button_save`,
`//input`) still match the Odoo 18 core templates — some kanban/form template internals were
restructured.

### f) jsTree navigation (`pwm_jstree_container.js`)
jsTree is a **jQuery plugin** and the component drives it through `$`/`.jstree(...)`. jQuery is not
loaded in the Odoo 18 web (backend) bundle by default. Ensure jQuery is available to this bundle
(e.g. add it to the module's `web.assets_backend`) or replace the jsTree-based navigation, otherwise
the left tags/types/vaults navigation will not render.

---

## Suggested test checklist (Odoo 18)
1. Module installs/upgrades cleanly (validates manifest, data, views, security).
2. Bundles kanban + password kanban open; create/edit a password; password strength shows.
3. Extra-bundle-password login flow (security dialog) works.
4. Left navigation (tags/types/vaults jsTree) renders and filters — depends on §6f.
5. Kanban multi-select + mass actions + export + clipboard copy — depends on §6a.
6. Settings page (duplicates criteria, mass actions, portal options).
7. Portal: `/my/password_vaults`, vault login, show/copy password — depends on §6d.
