/** @odoo-module **/

import {
    checkBundleSecurity,
    copy2ClipboardWithPopover,
} from "@odoo_password_manager/views/dialogs/password_login_dialog/password_login_dialog";
// ODOO 18 MIGRATION: KanbanModel / KanbanModel.Record (@web/views/kanban/kanban_model) were removed in
// Odoo 17. Kanban now uses the generic RelationalModel with Record from @web/model/relational_model/*.
// The selection/clipboard customization below relies on the pre-17 kanban model API
// (model.notify, record.toggleSelection, record.data) and needs re-validation in Odoo 18.
// See MIGRATION_NOTES.md.
import { RelationalModel } from "@web/model/relational_model/relational_model";
import { Record } from "@web/model/relational_model/record";
import { PasswordKanbanDynamicRecordList } from "./password_kanban_dynamic_list";
import { useService } from "@web/core/utils/hooks";


export class PasswordKanbanModel extends RelationalModel {
    /*
    * Re-write to introduce selected records, so our list will be able to save previous selection
    */
    setup(params) {
        this.orm = useService("orm");
        this.dialogService = useService("dialog");
        this.popover = useService("popover");
        if (params.rootState) {
            // restore from previous list (used especially for switching between views)
            this.selectedRecords = params.rootState.selectedRecords || [];
        }
        else {
            this.selectedRecords = [];
        }
        super.setup(...arguments);
    }
    /*
    * The method to add/remove record from SelectedRecords
    */
    _updateModelSelection(record, selected, noReselection) {
        if (!noReselection) {
            if (selected) {
                this.selectedRecords.push(record)
            }
            else {
                this.selectedRecords = this.selectedRecords.filter(rec => rec.id != record.id)
            };
        }
    }
    /*
    * The method to save record data for selection
    */
    getSelectedData(recordData) {
        return {
            "id": recordData.id, 
            "name": recordData.name,
            "user_name": recordData.user_name,
            "link_url": recordData.link_url,
            "password_len": recordData.password_len,
        }
    }
};

export class PasswordKanbanRecord extends Record {
    /*
    * The method to manage kanban records clicks: to add an item to selection
    */
    async onRecordClick(ev, options = {}) {
        await checkBundleSecurity([this.data.bundle_id[0]], this.model.orm, this.model.dialogService);
        this.toggleSelection(!this.selected);
    }
    /*
    * The method to copy user name
    */
    async onCopyData(ev, factor="user_name") {
        await checkBundleSecurity([this.data.bundle_id[0]], this.model.orm, this.model.dialogService);
        if (factor == "user_name") {
            this._onCopyClipboard(ev, this.data[factor]);
        }
        else if (factor == "link_url") {
            window.open(this.data[factor], "_blank");
        }
        else if (factor == "password") {
            const passwordlist = await this.model.orm.read("password.key", [this.data.id], ["password"]);
            const password = passwordlist[0].password;
            await this._onCopyClipboard(ev, password);
        };
    }
    /*
    * Overwrite to save selection for model, not only in a record. The idea is to not update selection after each reload
    */
    async toggleSelection(selected, noReselection) {
        super.toggleSelection(selected);
        this.model._updateModelSelection(this.model.getSelectedData(this.data), selected, noReselection);
        if (selected && !noReselection && this.data.user_name) {
            await this._onCopyClipboard(false, this.data.user_name);
        };
    }
    /*
    * The method to copy for clipboard
    */
    async _onCopyClipboard(event, value) {
        const popoverEl = event ? event.target : false;
        await copy2ClipboardWithPopover(this.model.popover, popoverEl, value);
    }
};

PasswordKanbanModel.Record = PasswordKanbanRecord;
PasswordKanbanModel.DynamicRecordList = PasswordKanbanDynamicRecordList;
