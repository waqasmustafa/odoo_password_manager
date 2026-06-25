/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { browser } from "@web/core/browser/browser";
import { Component, onMounted, onWillUnmount } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { Tooltip } from "@web/core/tooltip/tooltip";
import { useChildRef } from "@web/core/utils/hooks";
import { useService } from "@web/core/utils/hooks";
import { View } from "@web/views/view";


export class PasswordLoginDialog extends Component {
    setup() {
        super.setup();
        this.actionService = useService("action");
        this.modalRef = useChildRef();
        this.unSuccessFullLogin = true;
        const buttonTemplate = "odoo_password_manager.FormViewDialog.buttons";
        this.viewProps = {
            type: "form",
            buttonTemplate: buttonTemplate,
            context: this.props.context || {},
            display: { controlPanel: false },
            mode: "edit",
            resId: this.props.resId || false,
            resModel: this.props.resModel,
            viewId: this.props.viewId || false,
            preventCreate: false,
            preventEdit: false,
            discardRecord: () => {
                this.props.close();
            },
            saveRecord: async (record, { saveAndNew }) => {
                const saved = await record.save({ stayInEdition: true, noReload: true });
                if (saved) {
                    await this.props.onRecordSaved(record);
                    this.unSuccessFullLogin = false;
                    this.props.close();
                }
            },
        };
        onMounted(() => {
            // Hide excess buttons
            if (this.modalRef.el.querySelector(".modal-footer").childElementCount > 1) {
                const defaultButton = this.modalRef.el.querySelector(
                    ".modal-footer button.o-default-button"
                );
                if (defaultButton) {
                    defaultButton.classList.add("d-none");
                }
            }
        });
        onWillUnmount(() => {
            // Returns to bundles overview
            if (this.unSuccessFullLogin) {
                this.actionService.doAction("odoo_password_manager.password_bundle_action", { clearBreadcrumbs: true });
            }
        });
    }
}

PasswordLoginDialog.template = "odoo_password_manager.PasswordLoginDialog";
PasswordLoginDialog.components = { Dialog, View };
PasswordLoginDialog.props = {
    close: Function,
    resModel: String,
    context: { type: Object, optional: true },
    mode: {
        optional: true,
        validate: (m) => ["edit", "readonly"].includes(m),
    },
    onRecordSaved: { type: Function, optional: true },
    // removeRecord: { type: Function, optional: true },
    resId: { type: [Number, Boolean], optional: true },
    title: { type: String, optional: true },
    viewId: { type: [Number, Boolean], optional: true },
    size: Dialog.props.size,
};
PasswordLoginDialog.defaultProps = {
    onRecordSaved: () => {},
};
/*
* The method to check security for specific bundles and trigger the Log in dialog if needed
* @param bundleIds - list of ints
* @param ormService - component orm service
* @param dialogService - component dialog service
*/
export async function checkBundleSecurity(bundleIds, ormService, dialogService) {
    const failed_bundle_ids = await ormService.call("password.bundle", "action_check_bundle_key", [bundleIds]);
    if (failed_bundle_ids.length == 0) {
        return true;
    }
    for (const bundleId of failed_bundle_ids) {
        await new Promise((resolve) => {
            dialogService.add(PasswordLoginDialog, {
                resModel: "bundle.login",
                title: _t("Log in"),
                context: {"default_bundle_id": bundleId, "need_password_check": true},
                onRecordSaved: async (formRecord) => {
                    resolve(true);
                },
            });
        });
    }
    return true;
}
/*
* The method to copy a value to the clipboard
*/
export async function copy2ClipboardWithPopover(popoverService, popoverEl, value) {
    var popoverTooltip = _t("Successfully copied!"),
        popoverClass = "text-success",
        popoverTimer = 800;
    try {
        setTimeout(() => {
          browser.navigator.clipboard.writeText(value);
        }, 0)
    }
    catch {
        popoverTooltip = _t("Error! This browser doesn't allow to copy to clipboard");
        popoverClass = "text-danger";
        popoverTimer = 2500;
    };
    // popoverEl is now a plain DOM element (jQuery was removed from the backend in Odoo 17+)
    if (popoverEl) {
        const closeTooltip = popoverService.add(
            popoverEl, Tooltip, { tooltip: popoverTooltip }, { popoverClass: popoverClass },
        );
        browser.setTimeout(() => { closeTooltip() }, popoverTimer);
    };
};
