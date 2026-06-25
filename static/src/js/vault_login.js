/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { rpc } from "@web/core/network/rpc";
import { App } from "@odoo/owl";
import { PortalPassword } from "@odoo_password_manager/components/portal_password/portal_password";

/*
* Initiate the widgets to enter the portal password vault
*/
publicWidget.registry.vaultLogin = publicWidget.Widget.extend({
    selector: "#portal_vault_container",
    events: {
        "click #portal_vault_login": "_onLogin",
        "click #portal_vault_info": "_onShowInfo",
    },
    /*
    * The method to check the entered password an update session correspondingly
    */
    async _onLogin(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const passwordInput = document.getElementById("portal_vault_password");
        const loggedIn = await rpc("/web/dataset/call_kw", {
            model: "portal.password.bundle",
            method: "action_check_entered_password",
            args: [[parseInt(passwordInput.dataset.id)], passwordInput.value],
            kwargs: {},
        });
        if (loggedIn) { window.location.reload() };
    },
});


/*
* Initiate the widgets to enter the portal password vault
*/
publicWidget.registry.portalPasswordMask = publicWidget.Widget.extend({
    selector: ".portal_vault_mask",
    /*
    * Re-write to initiate password mask component
    */
    async start() {
        const passwordSpan = this.el;
        const app = new App(PortalPassword, {
            props: {
                passwordId: parseInt(passwordSpan.dataset.id),
                passwordLen: parseInt(passwordSpan.dataset.pw_len),
                showPopover: this._showPopover.bind(this),
            },
            env: {},
        });
        await app.mount(passwordSpan);
    },
    /*
    * The method to show/hide a popopver for copy to the clipboard actopm
    * The jQuery Bootstrap popover plugin was dropped (Bootstrap 5); use the native Popover class.
    */
    _showPopover(notification) {
        const copyButton = this.el.querySelector(".fa-paste");
        if (!copyButton) {
            return;
        }
        const popover = window.Popover.getOrCreateInstance(copyButton, {
            content: notification,
            placement: "bottom",
            html: true,
            trigger: "manual",
        });
        popover.show();
        setTimeout(() => popover.dispose(), 1000);
    }
});
