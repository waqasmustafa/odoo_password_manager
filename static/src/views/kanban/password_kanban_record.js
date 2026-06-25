/** @odoo-module **/

import { KanbanRecord } from "@web/views/kanban/kanban_record";
// ODOO 18 MIGRATION: the kanban "kanban-box" template was renamed to "card" in Odoo 18 and
// KANBAN_BOX_ATTRIBUTE was removed from kanban_arch_parser. The custom record template below
// (which re-wraps the card to add click/keydown handlers) must be re-checked against the Odoo 18
// KanbanRecord implementation. See MIGRATION_NOTES.md.
import { KANBAN_CARD_ATTRIBUTE } from "@web/views/kanban/kanban_arch_parser";
import { user } from "@web/core/user";
import { xml } from "@odoo/owl";

const notGlobalActions = ["a", ".dropdown", ".oe_kanban_action", ".jstr-kanban-copy"].join(",");


export class PasswordKanbanRecord extends KanbanRecord {
    /*
    * ODOO 18: the `user_context` global is no longer available in kanban card templates. Expose the
    * current user id through the component (accessed as __comp__.pwmUserId in the card arch template).
    */
    get pwmUserId() {
        return user.userId;
    }
    /*
    * Re-write to add its own classes for selected kanban record
    */
    getRecordClasses() {
        let result = super.getRecordClasses();
        if (this.props.record.selected) {
            result += " jstr-kanban-selected";
        }
        return result;
    }
    /*
    * The method to manage clicks on kanban record > add to selection always
    */
    onGlobalClick(ev) {
        if (ev.target.closest(notGlobalActions)) {
            if (ev.target.closest(".jstr-kanban-copy")) {
                this.props.record.onCopyData(ev, ev.target.closest(".jstr-kanban-copy").id);
            }
            else { return }
        }
        else { this.props.record.onRecordClick(ev, {}) };
    }
    /*
    * The method to manage key presses on kanban view (always add to selection)
    */
    onKeydown(ev) {
        if (ev.key !== "Enter" && ev.key !== " ") { return };
        ev.preventDefault();
        return this.props.record.onRecordClick(ev, {});
    }
};

PasswordKanbanRecord.template = xml`
    <div
        role="article"
        t-att-class="getRecordClasses()"
        t-on-click.synthetic="onGlobalClick"
        t-on-keydown.synthetic="onKeydown"
        t-ref="root">
        <t t-call="{{ templates['${KANBAN_CARD_ATTRIBUTE}'] }}"/>
    </div>`;
