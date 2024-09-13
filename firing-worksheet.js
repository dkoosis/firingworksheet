/*
 * This program generates a worksheet for calculating the cost of firing ceramics at a studio.
 * Customers input the firing type, piece dimensions (height, width, length), and quantity.
 * The cost is then computed based on the firing type's unit cost and the total volume of the pieces.
 *
 * Example:
 * - 3 teacups (4"W x 2"L x 6"H) with "Oxidation ∆ 6" glaze: 3 * 4 * 2 * 6 * $0.03 = $4.32
 * - 4 pieces (5"W x 9"L x 8"H) with "Oxida tion ∆ 10" glaze: 4 * 5 * 9 * 8 * $0.06 = $86.40
 *
 * Multiple line items can be added, and the total cost is calculated accordingly.
 */

// Data and configuration
const WORKSHEET_HEADERS = [
  "Firing Type",
  "Unit Cost",
  "Height",
  "Width",
  "Length",
  "Volume",
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

const USDformatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const firingWorksheet = document.createElement("table");

// Main function
function createFiringWorksheet() {
  //console.log(arguments.callee.name)// dk DB
  firingWorksheet.classList.add("firing-worksheet");
  addStyles();
  document.body.appendChild(firingWorksheet);
  addHeaderRow();
  addWorksheetRow(); // switch? dk
  addTotalPriceRow(); // Ensure TotalPriceRow is created before adding new rows
  addRowButton();
}

function addStyles() {
  const styleElement = document.createElement("style");
  styleElement.textContent = `
 
    .firing-worksheet {
      border-collapse = collapse;
    }
    
    .fws-header {
      padding: 5px;
      background-color: #dddddd;
      border: 1px solid #dddddd;
    }

    .fws-display {
      padding: 5px;
      background-color: #eeeeee;
      border: 1px solid #eeeeee;
      text-align: right;
    }

    .fws-input {
      border: 1px solid #ffffff; 
      background-color: #ffffff;  
      width: 60px;
      appearance: textfield; 
      -moz-appearance: textfield; 
      text-align: right;
      padding: 0px;
    }

    .fws-firing-type {
      border: 1px solid #ffffff; 
      background-color: #ffffff;  
      padding: 0px;
    }

    .fws-total-row {
      background-color: #dddddd;
      border: 1px solid #dddddd;
      text-align: center;
    }    
    .fws-input-error {
       border-color: red; /* Change border color to red */
      background-color: #ffdddd;
    }
  }
  `;
  document.head.appendChild(styleElement);
}

function addHeaderRow() {
  const headerRow = firingWorksheet.insertRow();
  WORKSHEET_HEADERS.forEach((headerName) => {
    const th = document.createElement("th");
    th.textContent = headerName;
    th.classList.add("fws-header");
    headerRow.appendChild(th);
  });
}

function addTotalPriceRow() {
  const totalPriceRow = firingWorksheet.insertRow();
  totalPriceRow.classList.add("fws-total-row");

  // Column 1: "Firing Type" (unchanged)
  const firingTypeCell = totalPriceRow.insertCell();

  // Columns 2-5: "fws-error-message" (spanning 4 columns)
  const errorCell = totalPriceRow.insertCell();
  errorCell.colSpan = 4;
  errorCell.classList.add("fws-error-message");
  const errorSpan = document.createElement("span");
  errorSpan.classList.add("error-text");
  errorCell.appendChild(errorSpan);

  // Column 6: "Volume" (unchanged)
  const volumeCell = totalPriceRow.insertCell();

  // Column 7: "Quantity"
  const quantityCell = totalPriceRow.insertCell();
  quantityCell.textContent = "Total Price:";
  quantityCell.style.textAlign = "right";

  // Column 8: "Price"
  const priceCell = totalPriceRow.insertCell();
  const totalPriceSpan = document.createElement("span");
  totalPriceSpan.classList.add("fws-total");
  priceCell.appendChild(totalPriceSpan);

  // Column 9: "" (unchanged, likely for the delete button)
  totalPriceRow.insertCell();
}

function addWorksheetRow() {
  const newRow = firingWorksheet.insertRow();
  newRow.classList.add("fws-row");

  for (const header of WORKSHEET_HEADERS) {
    const cell = newRow.insertCell();
    cell.classList.add("fws-td");
    let element;

    switch (header) {
      case "Firing Type":
        element = document.createElement("select");
        for (const [optName, optCost] of Object.entries(FIRING_OPTIONS)) {
          const firingOption = document.createElement("option");
          firingOption.text = optName;
          firingOption.value = optCost;
          element.appendChild(firingOption);
        }
        element.addEventListener("change", (event) => { recalculate(event); });
        break;
      case "Height":
      case "Width":
      case "Length":
      case "Quantity":
        // columns for dimensions and quantity, input by user
        element = document.createElement("input");
        element.classList.add("fws-input");
        element.type = "number";
        element.value = 1; // Default value
        element.min = 1;
        element.step = 1;
        element.max = 120;
        element.addEventListener("change", (event) => { recalculate(event); });
        break;
      case "Volume":
      case "Price":
      case "Unit Cost":
        element = document.createElement("span");
        cell.classList.add("fws-display");
        break;
      case "":
        element = createDeleteButton(newRow);
        break;
      default:
        break;
    }// end switch

    // add class name
    if (header.replace(/\s/g, "")) {
      element.classList.add(`fws-${header.replace(/\s/g, "-").toLowerCase()}`);
    }
    cell.appendChild(element);
  }// end for


  // Set the default unit cost after the row is created
  const firingTypeSelect = newRow.querySelector(".fws-firing-type");
  firingTypeSelect.selectedIndex = 0; // Select the first option in the dropdown

  // Trigger price calculation by simulating a change event on a relevant input
  const anyInput = newRow.querySelector(".fws-input"); // Get any input field in the row
  if (anyInput) {
    const changeEvent = new Event('change');
    anyInput.dispatchEvent(changeEvent);
  }

  ensureTotalPriceRowIsLast();
}

function validateNumberInput(num) {
  const value = parseInt(num);
  return !isNaN(value) && value >= 1 && value <= 120;
}

function createDeleteButton(row) {
  const deleteButtonTd = document.createElement("td");
  deleteButtonTd.classList.add("fws-td");
  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Delete Row";
  deleteButton.addEventListener("click", () => {
    firingWorksheet.deleteRow(row.rowIndex);
    calculateTotalPrice();
  });
  deleteButtonTd.appendChild(deleteButton);
  return deleteButtonTd;
}

function ensureTotalPriceRowIsLast() {
  const totalPriceRow = firingWorksheet.querySelector(".fws-total-row");
  if (totalPriceRow) {
    firingWorksheet.appendChild(totalPriceRow);
  }
}

function recalculate(event) {
  console.log("recalc");
  if (!event.type) {
    calculateTotalPrice();
    return;
  }

  const row = event.target.closest("tr");
  const unitCost = parseFloat(row.querySelector(".fws-firing-type").value);
  let length = parseInt(row.querySelector(".fws-length").value);
  let width = parseInt(row.querySelector(".fws-width").value);
  let height = parseInt(row.querySelector(".fws-height").value);
  let quantity = parseInt(row.querySelector(".fws-quantity").value);

  // Input Validation - Ensure positive integers within limits and valid unit cost
  if (
    isNaN(length) || length < 1 || length > 120 ||
    isNaN(width) || width < 1 || width > 120 ||
    isNaN(height) || height < 1 || height > 120 ||
    isNaN(quantity) || quantity < 1 || quantity > 100
  ) {
    displayErrorMessage(event, "Invalid dimensions or quantity. Please use positive whole numbers within the allowed limits.");
    return;
  }

  if (unitCost <= 0 || unitCost >= 5) {
    displayErrorMessage(event, "Invalid unit cost. Please enter a value between 0 and 5.");
    return;
  }

  const volume = length * width * height;

  if (volume < 1 || volume >= 1000000) {
    displayErrorMessage(event, "Volume out of range. Please adjust dimensions.");
    return;
  }

  // Clear error message if all inputs are valid
  clearErrorMessage();

  // Proceed with calculations
  const price = unitCost * volume * quantity;
  row.querySelector(".fws-volume").textContent = volume;
  row.querySelector(".fws-unit-cost").textContent = USDformatter.format(unitCost);
  row.querySelector(".fws-price").textContent = USDformatter.format(price);

  calculateTotalPrice();
}

function displayErrorMessage(event, message) {
  const errorSpan = document.querySelector(".fws-error-message .error-text");
  if (errorSpan) {
    errorSpan.textContent = message;

    // Highlight the input fields that triggered the error
    const row = event.target.closest("tr");
    const inputFields = row.querySelectorAll(".fws-input");
    inputFields.forEach(field => field.classList.add("fws-input-error"));
  }
  const addButton = document.querySelector(".fws-addbutton"); 
  if (addButton) {
    addButton.disabled = true;
  }
}

function clearErrorMessage() {
  const errorSpan = document.querySelector(".fws-error-message .error-text");
  if (errorSpan) {
    errorSpan.textContent = "";

    // Remove error highlighting from all input fields
    const inputFields = document.querySelectorAll(".fws-input");
    inputFields.forEach(field => field.classList.remove("fws-input-error"));
  }
  const addButton = document.querySelector(".fws-addbutton"); 
  if (addButton) {
    console.log('enable button')
    addButton.disabled = false;
  }
}

function calculateTotalPrice() {
  let totalPrice = 0;
  const priceSpans = firingWorksheet.querySelectorAll(".fws-price");

  priceSpans.forEach((span) => {
    const priceText = span.textContent.replace(/[$,]/g, ""); // Remove currency symbols
    const priceValue = parseFloat(priceText);
    if (!isNaN(priceValue)) {
      totalPrice += priceValue;
    }
  });

  const totalPriceRow = firingWorksheet.querySelector(".fws-total-row");
  if (totalPriceRow) {
    totalPriceRow.querySelector(".fws-total").textContent = USDformatter.format(
      totalPrice
    );
  }
}

function addRowButton() {
  const addButton = document.createElement("button");
  addButton.textContent = "Add Row";
  addButton.classList.add("fws-addbutton")
  addButton.addEventListener("click", addWorksheetRow);
  document.body.appendChild(addButton);
}

// Initialization code
createFiringWorksheet();
