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
 * 
 * dk!
 */
class CeramicsFiringCalculator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        this.WORKSHEET_HEADERS = [
            "Firing Type",
            "Unit Cost",
            "Height",
            "Width",
            "Length",
            "Volume",
            "Quantity",
            "Price",
            "", // For the delete button column
        ];

        this.FIRING_OPTIONS = {
            Bisque: 0.04,
            "Slipcast Bisque": 0.06,
            "Oxidation ∆ 6": 0.04,
            "Reduction ∆ 10": 0.04,
        };

        this.USDformatter = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        });

        console.log("Ceramics Firing Calculator component initialized!");
    }

    connectedCallback() {
        this.lineItems = [];
        this.totalCost = 0;

        const template = document.createElement('template');
        template.innerHTML = `
      <style>
        /* CSS styles for the table and error handling */
        table {
          width: 100%;
          border-collapse: collapse;
        }

        td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: right;
        }

        input, select {
          text-align: right;
          border: 0px;
        }
        
        th {
          border: 1px solid #ddd;
          padding: 8px;
          background-color: #f0f0f0;
          text-align: center;
        }

        td[data-error]::after {
          content: attr(data-error);
          color: red;
          font-size: 12px;
          display: block;
        }

        .invalid-input {
          border-color: red; 
        }
      </style>

      <table>
        <thead>
          <tr>
            ${this.WORKSHEET_HEADERS.map(header => `<th>${header}</th>`).join('')} 
          </tr>
        </thead>
        <tbody id="data-rows"></tbody>
        <tfoot>
          <tr>
            <td colspan="7">Total Price:</td>
            <td id="total-price">$0.00</td>
            <td></td> 
          </tr>
        </tfoot>
      </table>

      <button id="add-row-button">Add Row</button>
      <button id="submit-worksheet-button">Submit Worksheet</button>
    `;

        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.dataRows = this.shadowRoot.getElementById('data-rows');
        const addRowButton = this.shadowRoot.getElementById('add-row-button');
        const submitWorksheetButton = this.shadowRoot.getElementById('submit-worksheet-button');

        // Add an initial row to the table
        const initialRow = this.createRow();
        this.dataRows.appendChild(initialRow);

        // Event listeners for firing type selection and input changes
        this.dataRows.addEventListener('change', (event) => {
            const target = event.target;
            if (target.tagName === 'SELECT') {
                // Handle firing type selection
                const row = target.closest('tr');
                const unitCostCell = row.cells[1];
                const selectedFiringType = target.value;
                const unitCost = this.FIRING_OPTIONS[selectedFiringType] || 0;
                unitCostCell.textContent = this.USDformatter.format(unitCost);

                // Recalculate volume and price for this row
                this.calculateRowValues(row);

                // Update total cost
                this.updateTotalCost();
            } else if (target.tagName === 'INPUT') {
                // Handle dimension or quantity input changes
                const row = target.closest('tr');
                const cell = target.closest('td');

                // Input validation
                const errorMessage = this.isValidInput(target.value);
                if (errorMessage) {
                    cell.setAttribute('data-error', errorMessage);
                    target.classList.add('invalid-input');
                    return;
                } else {
                    cell.removeAttribute('data-error');
                    target.classList.remove('invalid-input');
                }

                // Recalculate volume and price for this row
                this.calculateRowValues(row);

                // Update total cost
                this.updateTotalCost();
            }
        });

        // Event listener for "Delete" buttons
        this.dataRows.addEventListener('click', (event) => {
            const target = event.target;
            if (target.tagName === 'BUTTON' && target.textContent === 'Delete') {
                const row = target.closest('tr');
                row.remove();

                // Update total cost after deleting a row
                this.updateTotalCost();
            }
        });

        // Event listener for "Add Row" button
        addRowButton.addEventListener('click', () => {
            const newRow = this.createRow();
            this.dataRows.appendChild(newRow);
        });

        // Event listener for "Submit Worksheet" button
        submitWorksheetButton.addEventListener('click', () => {
            const worksheetData = this.getTableData();
            const event = new CustomEvent('submitWorksheet', {
                detail: { data: worksheetData }
            });
            this.dispatchEvent(event);
        });
    }

    createRow() {
        const row = document.createElement("tr");

        const firingTypeCell = document.createElement("td");
        const firingTypeSelect = document.createElement("select");
        for (const firingType in this.FIRING_OPTIONS) {
            const option = document.createElement("option");
            option.value = firingType;
            option.text = firingType;
            firingTypeSelect.appendChild(option);
        }
        firingTypeCell.appendChild(firingTypeSelect);
        row.appendChild(firingTypeCell);

        // Unit Cost cell
        const unitCostCell = document.createElement('td');
        const defaultFiringType = firingTypeSelect.value; // Get the default selected firing type
        const unitCost = this.FIRING_OPTIONS[defaultFiringType] || 0;
        unitCostCell.textContent = this.USDformatter.format(unitCost);
        row.appendChild(unitCostCell);

        // Dimension input cells (height, width, length)
        const dimensionInputs = ["height", "width", "length"].map((dimension) => {
            const cell = document.createElement("td");
            const input = document.createElement("input");
            input.type = "number";
            input.min = 1;
            input.max = 120;
            input.value = 1;
            input.border = 0;
            input.align = "right";
            cell.appendChild(input);
            return cell;
        });
        row.append(...dimensionInputs);

        // Volume cell
        const volumeCell = document.createElement("td");
        volumeCell.textContent = 1; // Initial volume calculation with default dimensions (1 x 1 x 1)
        row.appendChild(volumeCell);

        // Quantity cell
        const quantityCell = document.createElement("td");
        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.min = 1;
        quantityInput.max = 120;
        quantityInput.value = 1;
        quantityCell.appendChild(quantityInput);
        row.appendChild(quantityCell);

        // Price cell
        const priceCell = document.createElement("td");
        priceCell.textContent = "$0.00";
        row.appendChild(priceCell);

        // Delete button cell
        const deleteButtonCell = document.createElement("td");
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButtonCell.appendChild(deleteButton);
        row.appendChild(deleteButtonCell);

        // Calculate initial price based on default values
        this.calculateRowValues(row); // Call calculateRowValues after the row is fully created

        return row;
    }

    calculateRowValues(row) {
        const height = parseInt(row.cells[2].querySelector("input").value) || 0;
        const width = parseInt(row.cells[3].querySelector("input").value) || 0;
        const length = parseInt(row.cells[4].querySelector("input").value) || 0;
        const quantity = parseInt(row.cells[6].querySelector("input").value) || 0;

        const volume = height * width * length;
        const unitCost = parseFloat(row.cells[1].textContent.replace("$", "")) || 0;
        const price = volume * quantity * unitCost;

        row.cells[5].textContent = volume; // Update volume cell
        row.cells[7].textContent = this.USDformatter.format(price); // Update price cell

        // Update total cost after calculating row values
        this.updateTotalCost();

    }

    updateTotalCost() {
        this.totalCost = 0;
        const rows = this.dataRows.querySelectorAll("tr");
        rows.forEach((row) => {
            const priceText = row.cells[7].textContent; // Assuming Price is the 8th cell
            const price = parseFloat(priceText.replace("$", "")) || 0;
            this.totalCost += price;
        });

        const totalPriceCell = this.shadowRoot.getElementById("total-price");
        totalPriceCell.textContent = this.USDformatter.format(this.totalCost);
    }

    isValidInput(value) {
        const parsedValue = parseInt(value);
        if (isNaN(parsedValue)) {
            return "Please enter a number.";
        } else if (parsedValue <= 0 || parsedValue > 120) {
            return "Please enter a number between 1 and 120.";
        } else {
            return ""; // No error
        }
    }

    getTableData() {
        const data = [];
        const rows = this.dataRows.querySelectorAll("tr");

        rows.forEach((row) => {
            const firingType = row.cells[0].querySelector("select").value;
            const unitCost = parseFloat(row.cells[1].textContent.replace("$", "")) || 0;
            const height = parseInt(row.cells[2].querySelector("input").value) || 0;
            const width = parseInt(row.cells[3].querySelector("input").value) || 0;
            const length = parseInt(row.cells[4].querySelector("input").value) || 0;
            const volume = parseInt(row.cells[5].textContent) || 0;
            const quantity = parseInt(row.cells[6].querySelector("input").value) || 0;
            const price = parseFloat(row.cells[7].textContent.replace("$", "")) || 0;

            // Generate a consistent ID for the product
            const _id = this.generateProductID({ firingType, height, width, length });

            data.push({
                _id,
                firingType,
                unitCost,
                height,
                width,
                length,
                volume,
                quantity,
                price,
            });
        });

        return data;
    }

    generateProductID({ firingType, height, width, length }) {
        // Create a unique string based on product attributes
        const rawID = `${firingType}-${height}-${width}-${length}`;
        // Generate a hash for uniqueness
        let hash = 0;
        for (let i = 0; i < rawID.length; i++) {
            hash = (hash << 5) - hash + rawID.charCodeAt(i);
            hash |= 0; // Convert to 32-bit integer
        }
        return `${Math.abs(hash)}`; // Ensure positive ID
    }
}

customElements.define("ceramics-firing-calculator", CeramicsFiringCalculator);
