/*
 * Version 11
 * This program generates a worksheet for calculating the cost of firing ceramics at a studio.
 * Customers input the firing type, piece dimensions (height, width, length), and quantity.
 * The cost is then computed based on the firing type's unit cost and the total volume of the pieces.
 *
 * Example:
 * - 3 teacups (4"W x 2"L x 6"H) with "Oxidation ∆ 6" glaze: 3 * 4 * 2 * 6 * $0.03 = $4.32
 * - 4 pieces (5"W x 9"L x 8"H) with "Oxidation ∆ 10" glaze: 4 * 5 * 9 * 8 * $0.06 = $86.40
 *
 * Multiple line items can be added, and the total cost is calculated accordingly.
 */

// Data and configuration
const firingWorksheet = document.createElement("table");
firingWorksheet.classList.add("FiringWorksheet");

const WORKSHEET_HEADERS = [
    "Firing Type",
    "Unit Cost",
    "Height",
    "Width",
    "Length",
    "Quantity",
    "Price",
    ""
];

const FIRING_OPTIONS = {
    Bisque: 0.03,
    "Slipcast Bisque": 0.04,
    "Oxidation ∆ 6": 0.03,
    "Oxidation ∆ 10": 0.06,
    "Reduction ∆ 10": 0.06
};

/**
 * Adds the header row to the firing worksheet table.
 */
function addHeaders() {
    const headerRow = firingWorksheet.insertRow();
    WORKSHEET_HEADERS.forEach((headerName) => {
        const th = document.createElement("th");
        th.textContent = headerName;
        th.classList.add("worksheet-header");
        headerRow.appendChild(th);
    });
}

/**
 * Appends a dropdown selector for firing types to the specified table cell.
 * @param {HTMLTableRowElement} newRow - The table row to which the selector will be appended.
 */
function appendFiringTypeSelector(newRow) {
    const firingTypeSelector = document.createElement("select");
    firingTypeSelector.classList.add("FiringType");
    firingTypeSelector.style.border = "1px solid white";
    let defaultFiringTypeCost;
    for (const [optName, optCost] of Object.entries(FIRING_OPTIONS)) {
        const firingTypeOption = document.createElement("option");
        firingTypeOption.text = optName;
        firingTypeOption.value = optCost;

        // Set a default value (e.g., "Bisque") and store its cost
        if (optName === "Bisque") {
            firingTypeOption.selected = true;
            defaultFiringTypeCost = optCost;
        }
        firingTypeSelector.appendChild(firingTypeOption);
    }
    firingTypeSelector.addEventListener("change", (event) => {
        calculatePrice(event); // Trigger price calculation on change

        // Update the Unit Cost field using class name
        const row = event.target.closest("tr");
        const selectedFiringOptionCost = parseFloat(event.target.value);
        const formatter = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        });
        row.querySelector(".UnitCost").textContent = formatter.format(
            selectedFiringOptionCost
        );
    });

    const td = document.createElement("td");
    td.classList.add("worksheet-td");
    newRow.appendChild(td);
    td.appendChild(firingTypeSelector);
    calculateTotalPrice(); // Recalculate and update the grand total
}

/**
 * Adds a new row to the firing worksheet, including the firing type selector, input fields for dimensions and quantity,
 * spans for unit cost and price, and a delete button.
 */
function addWorksheetRow() {
    const newRow = firingWorksheet.insertRow();

    // Add dropdown
    appendFiringTypeSelector(newRow);

    for (let i = 1; i < 7; i++) {
        const td = document.createElement("td");
        td.classList.add("worksheet-td");
        newRow.appendChild(td);

        let el;
        if (i === 1 || i === 6) {
            // Span elements for Unit Cost and Price
            el = document.createElement("span");
            el.classList.add(WORKSHEET_HEADERS[i].replace(/\s/g, ""));
            if (i === 1) { // Unit Cost column
                const formatter = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD"
                });
                el.textContent = formatter.format(FIRING_OPTIONS["Bisque"]);
            } else if (i === 6) { // Price column
                el.classList.add("Price"); // Add the Price class
            }
        } else if (i > 1 && i < 6) {
            // Input fields for dimensions and quantity
            el = document.createElement("input");
            el.classList.add(
                WORKSHEET_HEADERS[i].replace(/\s/g, ""),
                "worksheet-input"
            );
            el.value = 2; // You might want to set default values or leave them blank
            el.type = "number";
            el.min = 1;
            el.width = "50px";
            el.addEventListener("input", calculatePrice);
        }
        td.appendChild(el);
    }

    // Add the delete button
    const deleteButtonTd = document.createElement("td");
    deleteButtonTd.classList.add("worksheet-td");
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete Row";
    deleteButton.addEventListener("click", () => {
        firingWorksheet.deleteRow(newRow.rowIndex);
        calculateTotalPrice(); // Recalculate total after deleting a row
    });

    deleteButtonTd.appendChild(deleteButton);
    newRow.appendChild(deleteButtonTd);

    // Trigger initial price calculation for the new row (after the row is fully created)
    calculatePrice({ target: newRow.querySelector(".Height") });

    // Ensure the Total Price row is always the last row
    firingWorksheet.appendChild(firingWorksheet.querySelector(".TotalPriceRow"));
}

/**
 * Creates and appends an "Add Row" button to the document body.
 * When clicked, it calls the `addWorksheetRow` function to add a new row to the worksheet.
 */
function addRowButton() {
    const addButton = document.createElement("button");
    addButton.textContent = "Add Row";
    addButton.addEventListener("click", addWorksheetRow);
    document.body.appendChild(addButton);
}

/**
 * Adds CSS styles to the document's <head> to style the firing worksheet table,
 * headers, cells, and input fields.
 */
function addStyles() {
    const styleElement = document.createElement("style");
    styleElement.textContent = `
        .worksheet-header {
            border: 1px solid black;
            padding: 5px;
            background-color: #cccccc;
        }

        .worksheet-td {
            border: 1px solid black; 
            padding: 5px;
            text-align: right; 
            background-color: #ffffff;
        }

        .worksheet-input {
            border: 0px solid white; 
            background-color: #ffffff;     
            appearance: textfield; 
            -moz-appearance: textfield; 
            text-align: right;
        }

        /* Add styles for FiringType selector */
        .FiringType {
            border: 1px solid white;
        }
    `;

    // Append the single <style> element to the <head>
    document.head.appendChild(styleElement);
}

/**
 * Calculates and updates the "Price" for a given row in the firing worksheet based on the selected firing type, dimensions, and quantity.
 * @param {Event} event - The event that triggered the price calculation (usually an input event on one of the dimension or quantity fields).
 */
function calculatePrice(event) {
    const row = event.target.closest("tr");

    // Get values from the row
    const selectedFiringOptionCost = parseFloat(
        row.querySelector(".FiringType").value
    );
    const height = parseFloat(row.querySelector(".Height").value) || 0;
    const width = parseFloat(row.querySelector(".Width").value) || 0;
    const length = parseFloat(row.querySelector(".Length").value) || 0;
    const quantity = parseFloat(row.querySelector(".Quantity").value) || 0;

    // Calculate the price
    const volume = height * width * length;
    const totalPrice = selectedFiringOptionCost * volume * quantity;

    // Format and display the price
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    });
    row.querySelector(".Price").textContent = formatter.format(totalPrice);
    calculateTotalPrice(); // Recalculate and update the grand total
}

/**
 * Calculates and updates the total price for all rows in the firing worksheet.
 */
function calculateTotalPrice() {
    let totalPrice = 0;
    const priceSpans = firingWorksheet.querySelectorAll(".Price");

    priceSpans.forEach((span) => {
        const priceText = span.textContent.replace(/[$,]/g, ""); // Remove currency symbols
        const priceValue = parseFloat(priceText);
        if (!isNaN(priceValue)) {
            totalPrice += priceValue;
        }
    });

    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    });

    const totalPriceRow = firingWorksheet.querySelector(".TotalPriceRow");
    if (totalPriceRow) {
        totalPriceRow.querySelector(".TotalPrice").textContent =
            formatter.format(totalPrice);
    }
}

/**
 * Main function to create the firing worksheet.
 */
function createFiringWorksheet() {
    addStyles();
    document.body.appendChild(firingWorksheet);
    firingWorksheet.style.borderCollapse = "collapse";
    addHeaders();

    // Add the Total Price row (create it only once)
    const totalPriceRow = firingWorksheet.insertRow();
    totalPriceRow.classList.add("TotalPriceRow");
    for (let i = 0; i < WORKSHEET_HEADERS.length; i++) {
        const td = document.createElement("td");
        td.classList.add("worksheet-td");
        totalPriceRow.appendChild(td);
        if (i === 4) { // Cell to the left of the Price column
            td.textContent = "Total Price:";
            td.style.textAlign = "right";
        } else if (i === 5) { // Price column
            const totalPriceSpan = document.createElement("span");
            totalPriceSpan.classList.add("TotalPrice");
            td.appendChild(totalPriceSpan);
        } else {
            td.textContent = "";
        }
    }

    calculateTotalPrice(); // Calculate the initial total price (0)
    addWorksheetRow();
    addRowButton();
}

createFiringWorksheet();