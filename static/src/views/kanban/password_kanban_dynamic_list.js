/** @odoo-module **/

// ODOO 18 MIGRATION: the kanban-specific model classes (@web/views/kanban/kanban_model:
// KanbanModel / KanbanDynamicRecordList / KanbanModel.Record) were removed in Odoo 17 when the
// relational model was unified. The kanban view now uses the generic RelationalModel with
// DynamicRecordList / Record from @web/model/relational_model/*. The custom multi-record
// "selectedRecords" selection below is built on the pre-17 API (record.toggleSelection, resId)
// and must be re-validated against Odoo 18. See MIGRATION_NOTES.md.
import { DynamicRecordList } from "@web/model/relational_model/dynamic_record_list";
import { useService } from "@web/core/utils/hooks";


export class PasswordKanbanDynamicRecordList extends DynamicRecordList {
    /*
    * Re-write to trigger toggle selection for the old selection
    */
    async load() {
        await super.load();
        const selectedRecords = this.model.selectedRecords;
        this.records.forEach(function (record) {
            if (selectedRecords.find(rec => rec.id === record.resId)) {
                record.toggleSelection(true, true);
            }
        });
    }
    /*
    * Overwrite to save selected records to state
    */
    exportState() {
        const state = {
            ...super.exportState(),
            selectedRecords: this.model.selectedRecords,
        };
        return state
    }
}
