/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { browser } from "@web/core/browser/browser";
import { useService } from "@web/core/utils/hooks";

import { Component, onWillStart, onMounted, useState } from "@odoo/owl";


export class PortalPassword extends Component {
    /*
    * Re-write to import required services and update props on the component start
    */
    setup() {
        this.mask = true;
        this.state = useState({ password: null });
        this.orm = useService("orm");
        onWillStart(async () => {
            await this._loadPasswordMask(false);
        });
    }
    /*
    * The method to save password mask (its length)
    * We purposefully do not keep real password for security purposes
    * We do load password when length is zero since migrated from previous versions passwords do not have length calced
    */
    async _loadPasswordMask() {
        var passwordMask = false,
            passwordLen = this.props.passwordLen;
        if (!passwordLen || passwordLen == 0) {
            const password = await this._loadPassword();
            passwordLen = password.length;
        };
        if (passwordLen > 0) {
            passwordMask = "*".repeat(passwordLen);
        };
        Object.assign(this.state, { password: passwordMask });
    }    
    /*
    * The method to get the password since it is not present on kanban card (purposefully to avoid decryption)
    */
    async _loadPassword() {
        const decryptedPassword = await this.orm.call(
            "portal.password.key",
            "action_return_decrypted_password",
            [[this.props.passwordId]],
        );
        if (decryptedPassword === null) {
            window.location.reload();
        }
        return decryptedPassword
    }
    /*
    * The method to show/hide the password
    */
    async _onTogglePassword(event) {
        if (this.mask) {
            const password = await this._loadPassword();
            Object.assign(this.state, { password: password });
        }
        else {
            await this._loadPasswordMask()
        };
        this.mask = !this.mask;
    }
    /*
    * The method to copy a password for clipboard
    */
    async _onCopyPassword(event) {
        const password = await this._loadPassword();
        var popoverTooltip = _t("Successfully copied!");
        try {
            setTimeout(() => {
                browser.navigator.clipboard.writeText(password);
            }, 0)
        } catch {
            popoverTooltip = _t("Error! This browser doesn't allow to copy to clipboard");
        };
        this.props.showPopover(popoverTooltip);
    }
};

PortalPassword.template = "odoo_password_manager.PortalPassword";
