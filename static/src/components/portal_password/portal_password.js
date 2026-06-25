/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { browser } from "@web/core/browser/browser";
import { rpc } from "@web/core/network/rpc";

import { Component, onWillStart, useState, xml } from "@odoo/owl";


export class PortalPassword extends Component {
    setup() {
        this.mask = true;
        this.state = useState({ password: null });
        onWillStart(async () => {
            await this._loadPasswordMask();
        });
    }
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
    async _loadPassword() {
        const decryptedPassword = await rpc("/web/dataset/call_kw", {
            model: "portal.password.key",
            method: "action_return_decrypted_password",
            args: [[this.props.passwordId]],
            kwargs: {},
        });
        if (decryptedPassword === null) {
            window.location.reload();
        }
        return decryptedPassword;
    }
    async _onTogglePassword() {
        if (this.mask) {
            const password = await this._loadPassword();
            Object.assign(this.state, { password: password });
        } else {
            await this._loadPasswordMask();
        }
        this.mask = !this.mask;
    }
    async _onCopyPassword() {
        const password = await this._loadPassword();
        var popoverTooltip = _t("Successfully copied!");
        try {
            setTimeout(() => {
                browser.navigator.clipboard.writeText(password);
            }, 0);
        } catch {
            popoverTooltip = _t("Error! This browser doesn't allow to copy to clipboard");
        }
        this.props.showPopover(popoverTooltip);
    }
}

PortalPassword.template = xml`
    <div t-if="state.password" class="d-flex">
        <div class="password-mask w-75" t-out="state.password"/>
        <div class="w-25">
            <a href="#" class="fa fa-paste password-preview-button"
               t-on-click.prevent="() => _onCopyPassword()"/>
            <a href="#" class="fa fa-eye password-preview-button"
               t-on-click.prevent="() => _onTogglePassword()"/>
        </div>
    </div>`;
