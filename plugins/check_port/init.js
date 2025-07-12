// Load language file and CSS for the plugin
plugin.loadLang();
plugin.loadMainCSS();

// Cache jQuery elements for performance and readability
const a = {};

// Flag to track if the UI has been built
plugin.ui_initialized = false;

/**
 * Resets the UI elements to a neutral/unknown state, typically while checking
 * @param {boolean} isUpdate - If true, indicates a manual refresh, adding "..." to the title
 */
plugin.resetStatus = function(isUpdate) {
	// Exit if the UI hasn't been created yet
	if (!plugin.ui_initialized) return;

	// Reset icons to the "unknown" state (pstatus0)
	if (a.iconIPv4) a.iconIPv4.removeClass().addClass("icon pstatus0").show();
	if (a.iconIPv6) a.iconIPv6.removeClass().addClass("icon pstatus0").show();

	// Hide IP address text and the separator
	if (a.textIPv4) a.textIPv4.text("").hide();
	if (a.separator) a.separator.text("").hide();
	if (a.textIPv6) a.textIPv6.text("").hide();

	// Set a tooltip to indicate that a check is in progress
	let title = theUILang.checkingPort || "Checking port status...";
	if (isUpdate) {
		title += "..."; // Append ellipsis for manual updates
	}
	a.pane.prop("title", title);
};

// Function to manually trigger an update of the port status
plugin.update = function() {
	plugin.resetStatus(true);
	// Request a port status update from the backend
	theWebUI.request("?action=updateportcheck", [plugin.getPortStatus, plugin]);
};

/**
 * Updates the UI for a specific IP protocol (IPv4 or IPv6) based on data from the backend
 * @param {object} data - The response data containing status for both protocols
 * @param {string} proto - The protocol to update, either "ipv4" or "ipv6"
 * @param {function} getStatusText - A function to retrieve the localized status string
 * @returns {string} The formatted title line for this protocol's status
 */
function updateProtocolStatus(data, proto, getStatusText) {
	const icon = (proto === 'ipv4') ? a.iconIPv4 : a.iconIPv6;
	const textEl = (proto === 'ipv4') ? a.textIPv4 : a.textIPv6;

	// If the elements for this protocol don't exist, exit.
	if (!icon) {
		return "";
	}

	const status = parseInt(data[proto + '_status']);
	const address = data[proto];
	const port = data[proto + '_port'];
	const isAvailable = address && address !== "-"; // Check if an IP address was returned

	// Update the icon class to reflect the current status
	icon.removeClass("pstatus0 pstatus1 pstatus2").addClass("pstatus" + status);

	let titleText = "";

	if (isAvailable) {
		icon.show();
		// Format display text as IP:PORT, with brackets for IPv6
		const displayText = (proto === 'ipv6') ? `[${address}]:${port}` : `${address}:${port}`;
		textEl.text(displayText).show();
		// Create a detailed title for the tooltip
		titleText = `${proto.toUpperCase()}: ${displayText} (${getStatusText(status)})`;
	} else {
		// If IP is not available on the server, hide the icon and the text element
		icon.hide();
		textEl.hide();
		// Still provide a title for debugging or information
		titleText = `${proto.toUpperCase()}: ${(theUILang.notAvailable || "N/A")}`;
	}
	return titleText;
}

/**
 * Main callback to process the port status response from the backend and update the UI
 * @param {object} d - The JSON object received from the backend response
 */
plugin.getPortStatus = function(d) {
	// On the first run, build the UI dynamically based on the configuration
	if (!plugin.ui_initialized) {
		// The pane container already exists, just clear it before building the final UI
		a.pane.empty();

		const container = a.pane; // Use the existing container

		if (d.use_ipv4) {
			container.append($("<div>").attr("id", "port-icon-ipv4").addClass("icon"));
			container.append($("<span>").attr("id", "port-ip-text-ipv4").addClass("d-none d-lg-block port-ip-text-segment"));
		}

		if (d.use_ipv4 && d.use_ipv6) {
			container.append($("<span>").attr("id", "port-ip-separator").addClass("d-none d-lg-block"));
		}

		if (d.use_ipv6) {
			container.append($("<div>").attr("id", "port-icon-ipv6").addClass("icon"));
			container.append($("<span>").attr("id", "port-ip-text-ipv6").addClass("d-none d-lg-block port-ip-text-segment"));
		}

		// Cache the newly created elements
		if (d.use_ipv4) {
			a.iconIPv4 = $("#port-icon-ipv4");
			a.textIPv4 = $("#port-ip-text-ipv4");
		}
		if (d.use_ipv4 && d.use_ipv6) {
			a.separator = $("#port-ip-separator");
		}
		if (d.use_ipv6) {
			a.iconIPv6 = $("#port-icon-ipv6");
			a.textIPv6 = $("#port-ip-text-ipv6");
		}

		// Attach the context menu if permitted
		if (plugin.canChangeMenu()) {
			a.pane.on("mousedown", plugin.createPortMenu);
		}
		plugin.ui_initialized = true;
	}

	// Helper function to get the localized text for a status code
	const getStatusText = (statusCode) => theUILang.portStatus[statusCode] || theUILang.portStatus[0] || "Unknown";

	// Update the status for both IPv4 and IPv6 and collect their title lines
	const titleLines = [
		updateProtocolStatus(d, 'ipv4', getStatusText),
		updateProtocolStatus(d, 'ipv6', getStatusText)
	].filter(line => line); // Filter out empty strings for disabled/unavailable protocols

	// Show a separator only if it exists and both protocol icons are visible
	if (a.separator) {
		if (a.iconIPv4.is(":visible") && a.iconIPv6.is(":visible")) {
			a.separator.text("|").show();
		} else {
			a.separator.text("").hide();
		}
	}

	// Set the combined tooltip for the entire status pane
	a.pane.prop("title", titleLines.join(" | "));
};

// Defines the AJAX request for the initial port check
rTorrentStub.prototype.initportcheck = function() {
	this.contentType = "application/x-www-form-urlencoded";
	this.mountPoint = "plugins/check_port/action.php?init";
	this.dataType = "json";
};

// Defines the AJAX request for subsequent port status updates
rTorrentStub.prototype.updateportcheck = function() {
	this.contentType = "application/x-www-form-urlencoded";
	this.mountPoint = "plugins/check_port/action.php";
	this.dataType = "json";
};

// Creates and shows the context menu (right-click menu) for the status pane
plugin.createPortMenu = function(e) {
	if (e.which === 3) { // Right mouse button
		theContextMenu.clear();
		// Add a "Refresh" option to the context menu
		theContextMenu.add([(theUILang.checkPort || "Refresh Port Status"), plugin.update]);
		theContextMenu.show();
	}
	return false; // Prevent the default browser context menu from appearing
};

plugin.onLangLoaded = function() {
	// Create a temporary loading state immediately
	const container = $("<div>").addClass("port-status-container")
		.append($("<div>").addClass("icon pstatus0")); // Add a single "unknown" icon as a placeholder

	plugin.addPaneToStatusbar("port-pane", container, -1, true);
	a.pane = $("#port-pane");
	a.pane.prop("title", theUILang.checkingPort || "Checking port status...");

	// Trigger the initial port check to get the configuration and build the final UI
	theWebUI.request("?action=initportcheck", [plugin.getPortStatus, plugin]);
};

// This function is called when the plugin is removed/unloaded
plugin.onRemove = function() {
	// Remove the pane from the status bar to clean up the UI
	plugin.removePaneFromStatusbar("port-pane");
};
