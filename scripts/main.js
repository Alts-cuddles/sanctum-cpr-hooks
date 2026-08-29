import "./ammo.js";
import "./machinegun.js";
import "./subcompactsmg.js";
import "./aimedcap.js";
import "./machinepistol.js";
import "./speedware.js";
import "./dvDisplay.js";
import "./onfire.js";
import "./overheat.js";
import "./redlace.js";
import "./drugs.js";
import "./slow.js";

Hooks.once("ready", () => {
  ui.notifications.info("Sanctum CPR Hooks loaded", { permanent: false });
  console.log("Sanctum CPR Hooks | Fully loaded");
});