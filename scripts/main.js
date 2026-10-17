import "./ammo.js";
import "./aimedcap.js";
import "./speedware.js";
import "./autofiredv.js";
import "./onfire.js";
import "./overheat.js";
import "./redlace.js";
import "./drugs.js";
import "./slow.js";
import "./techpower.js";

Hooks.once("ready", () => {
  ui.notifications.info("Sanctum CPR Hooks loaded", { permanent: false });
  console.log("Sanctum CPR Hooks | Fully loaded");
});
