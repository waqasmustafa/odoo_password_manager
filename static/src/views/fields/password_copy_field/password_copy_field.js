/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { CharField, charField } from "@web/views/fields/char/char_field";
import {
    checkBundleSecurity,
    copy2ClipboardWithPopover,
} from "@odoo_password_manager/views/dialogs/password_login_dialog/password_login_dialog";
import { FormViewDialog } from "@web/views/view_dialogs/form_view_dialog";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { useState } from "@odoo/owl";


export class PasswordCopyField extends CharField {
    /*
    * Re-write to add popopve
    */
    setup() {
        this.popover = useService("popover");
        this.orm = useService("orm");
        this.dialogService = useService("dialog");
        this.state = useState({ isPassword: this.props.isPassword });
        super.setup(...arguments);
    }
    /*
    * Getter for bundle id: we take that from the form
    */
    get bundleIds() {
        if (this.props.record.data.bundle_id && this.props.record.data.bundle_id.length != 0) {
            return [this.props.record.data.bundle_id[0]]
        }
        return false
    }
    /*
    * The method to wrap bundle security check with extra considerations
    */
    async _checkSecurityWrapper() {
        if (!this.props.logIn) {
            if (!this.bundleIds) {
                return false;
            };
            const valid = await checkBundleSecurity(this.bundleIds, this.orm, this.dialogService);
            return valid
        }
        return true
    }

    /*
    * The method to copy the value for clipboard
    */
    async _onCopyClipboard(event) {
        const valid = await this._checkSecurityWrapper();
        if (!valid) { return false };
        const content2Copy = this.props.record.data[this.props.name];
        const popoverEl = event.target.closest("div");
        copy2ClipboardWithPopover(this.popover, popoverEl, content2Copy);
    }
    /*
    * The method to show the password
    */
    async _onShowPassword() {
        const valid = await this._checkSecurityWrapper();
        if (!valid) { return false };
        Object.assign(this.state, { isPassword: !this.state.isPassword });
    }
    /*
    * The method to generate new password
    */
    async _onGeneratePassword() {
        const valid = await this._checkSecurityWrapper();
        if (!valid) { return false };
        this.dialogService.add(FormViewDialog, {
            resModel: "password.generator",
            title: _t("Password Generator"),
            onRecordSaved: async (formRecord) => { 
                const newPassword = await this.orm.call(
                    "password.key",
                    "action_generate_new_password",
                    [formRecord.data.pwlength, formRecord.data.pwcharset],
                );
                const changes = {
                    "password": newPassword,
                    "confirm_password": newPassword,
                }
                this.props.record.update(changes);
            },
        });
    }
    /*
    * The method to open external URL
    */
    async _onOpenLink() {
        const valid = await this._checkSecurityWrapper();
        if (!valid) { return false };
        await checkBundleSecurity(this.bundleIds, this.orm, this.dialogService);
        window.open(this.props.record.data[this.props.name], "_blank");
    }
    /*
    * The method to log in if the 'Enter' key is pressed (applicable for bundle key log in dialog)
    */
    async _onKeydown(ev) {
        if (this.props.logIn && ev.keyCode === 13) {
            document.querySelector(".o_form_button_save")?.click();
        };
    }
};

PasswordCopyField.template = "odoo_password_manager.PasswordCopyField";
PasswordCopyField.props = {
    ...CharField.props,
    isExternalLink: { type: Boolean, optional: true },
    inputPadding: { type: Number, optional: true },
    logIn: { type: Boolean, optional: true },
};

// ODOO 18: fields are registered as descriptor objects ({ component, extractProps, ... }), not bare
// classes with static props. Custom <field> attributes are no longer forwarded to widgets; they must
// be passed through options="{...}" and read from fieldInfo.options here.
export const passwordCopyField = {
    ...charField,
    component: PasswordCopyField,
    displayName: _t("Password"),
    supportedTypes: ["char"],
    supportedOptions: [
        { label: _t("External link"), name: "password_link", type: "boolean" },
        { label: _t("Small input"), name: "password_small", type: "boolean" },
        { label: _t("Log in field"), name: "log_in", type: "boolean" },
    ],
    extractProps(fieldInfo, dynamicInfo) {
        const props = charField.extractProps(fieldInfo, dynamicInfo);
        const options = fieldInfo.options || {};
        props.isExternalLink = Boolean(options.password_link);
        props.inputPadding = options.password_small ? 25 : 70;
        props.logIn = Boolean(options.log_in);
        return props;
    },
};

registry.category("fields").add("PasswordCopy", passwordCopyField);
