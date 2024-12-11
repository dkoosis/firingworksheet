class CeramicsFiringCalculator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        // Constants
        this.MAX_DIMENSION = 55;
        this.MAX_QUANTITY = 120;
        this.WORKSHEET_HEADERS = [
            "Firing Type",
            "Unit Cost",
            "Height",
            "Width",
            "Length",
            "Volume",
            "Quantity",
            "Price",
            "Due Date",
            "Special Directions",
            ""  // Delete button column
        ];

        // Default firing options in case config fails to load
        this.FIRING_OPTIONS = {
            "Bisque": 0.04,
            "Slipcast Bisque": 0.06,
            "Oxidation ∆ 6": 0.04,
            "Reduction ∆ 10": 0.04
        };
        this.rushJobDays = 3;
        this.rushJobPremium = 25;

        // Try to load config
        try {
            const config = require('../config.json');
            this.FIRING_OPTIONS = config.firingOptions || this.FIRING_OPTIONS;
            this.rushJobDays = config.rushJobDays || this.rushJobDays;
            this.rushJobPremium = config.rushJobPremium || this.rushJobPremium;
        } catch (error) {
            console.error('Failed to load config, using defaults:', error);
        }

        this.USDformatter = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        });

        this.lineItems = [];
        this.totalCost = 0;
    }

    connectedCallback() {
        const template = document.createElement('template');
        template.innerHTML = `
            <style>
                :host {
                    font-family: Arial, sans-serif;
                    display: block;
                    padding: 20px;
                    background-color: #f8f9fa;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    background-color: white;
                    border: 1px solid #dee2e6;
                }

                th {
                    padding: 12px;
                    background-color: #343a40;
                    color: white;
                    font-weight: bold;
                    text-align: center;
                }

                td {
                    padding: 8px;
                    border: 1px solid #dee2e6;
                    text-align: center;
                }

                input, select, textarea {
                    width: 90%;
                    padding: 6px;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    font-size: 14px;
                }

                .invalid-input {
                    border-color: #dc3545;
                    background-color: #f8d7da;
                }

                td[data-error]::after {
                    content: attr(data-error);
                    color: #dc3545;
                    font-size: 12px;
                    display: block;
                }

                button {
                    background-color: black;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    margin-right: 10px;
                }

                button:hover {
                    background-color: #F15A29;
                }

                @media (max-width: 768px) {
                    table {
                        display: block;
                        overflow-x: auto;
                    }
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
                        <td colspan="3"></td>
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

        // Add initial row
        this.addRow();

        // Event listeners
        this.dataRows.addEventListener('change', this.handleRowChange.bind(this));
        this.dataRows.addEventListener('click', this.handleDelete.bind(this));
        addRowButton.addEventListener('click', () => this.addRow());
        submitWorksheetButton.addEventListener('click', () => this.submitWorksheet());
    }

    handleRowChange(event) {
        const target = event.target;
        const row = target.closest('tr');

        if (target.tagName === 'SELECT') {
            const unitCostCell = row.cells[1];
            const selectedFiringType = target.value;
            const unitCost = this.FIRING_OPTIONS[selectedFiringType] || 0;
            unitCostCell.textContent = this.USDformatter.format(unitCost);
        }

        if (target.type === 'number') {
            const cell = target.closest('td');
            const error = this.validateInput(target.value);
            
            if (error) {
                cell.setAttribute('data-error', error);
                target.classList.add('invalid-input');
                return;
            } else {
                cell.removeAttribute('data-error');
                target.classList.remove('invalid-input');
            }
        }

        this.calculateRowValues(row);
        this.updateTotalCost();
    }

    handleDelete(event) {
        if (event.target.tagName === 'BUTTON' && event.target.textContent === 'Delete') {
            const row = event.target.closest('tr');
            row.remove();
            this.updateTotalCost();
        }
    }

    validateInput(value) {
        if (!value) return "Field required";
        const num = parseInt(value);
        if (isNaN(num)) return "Must be a number";
        if (num <= 0) return "Must be positive";
        if (num > this.MAX_DIMENSION) return `Max ${this.MAX_DIMENSION}`;
        return null;
    }

    addRow() {
        const row = document.createElement('tr');
        
        // Firing type select
        const firingTypeCell = document.createElement('td');
        const firingTypeSelect = document.createElement('select');
        Object.keys(this.FIRING_OPTIONS).forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.text = type;
            firingTypeSelect.appendChild(option);
        });
        firingTypeCell.appendChild(firingTypeSelect);
        row.appendChild(firingTypeCell);

        // Unit cost
        const unitCostCell = document.createElement('td');
        const initialUnitCost = this.FIRING_OPTIONS[firingTypeSelect.value] || 0;
        unitCostCell.textContent = this.USDformatter.format(initialUnitCost);
        row.appendChild(unitCostCell);

        // Dimension inputs (height, width, length)
        ['height', 'width', 'length'].forEach(() => {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '1';
            input.max = String(this.MAX_DIMENSION);
            input.value = '1';
            cell.appendChild(input);
            row.appendChild(cell);
        });

        // Volume
        const volumeCell = document.createElement('td');
        volumeCell.textContent = '1';
        row.appendChild(volumeCell);

        // Quantity
        const quantityCell = document.createElement('td');
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '1';
        quantityInput.max = String(this.MAX_QUANTITY);
        quantityInput.value = '1';
        quantityCell.appendChild(quantityInput);
        row.appendChild(quantityCell);

        // Price
        const priceCell = document.createElement('td');
        priceCell.textContent = this.USDformatter.format(0);
        row.appendChild(priceCell);

        // Due date
        const dueDateCell = document.createElement('td');
        const dueDateInput = document.createElement('input');
        dueDateInput.type = 'date';
        dueDateInput.min = new Date().toISOString().split('T')[0];
        dueDateCell.appendChild(dueDateInput);
        row.appendChild(dueDateCell);

        // Special directions
        const directionsCell = document.createElement('td');
        const directionsInput = document.createElement('textarea');
        directionsCell.appendChild(directionsInput);
        row.appendChild(directionsCell);

        // Delete button
        const deleteCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteCell.appendChild(deleteButton);
        row.appendChild(deleteCell);

        this.dataRows.appendChild(row);
        this.calculateRowValues(row);
    }

    calculateRowValues(row) {
        const height = parseInt(row.cells[2].querySelector('input').value) || 0;
        const width = parseInt(row.cells[3].querySelector('input').value) || 0;
        const length = parseInt(row.cells[4].querySelector('input').value) || 0;
        const quantity = parseInt(row.cells[6].querySelector('input').value) || 0;
        const dueDate = row.cells[8].querySelector('input').value;

        const volume = height * width * length;
        const unitCost = parseFloat(row.cells[1].textContent.replace(/[^0-9.-]+/g, '')) || 0;
        let price = volume * quantity * unitCost;

        if (dueDate) {
            const daysDiff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= this.rushJobDays) {
                price *= (1 + this.rushJobPremium / 100);
            }
        }

        row.cells[5].textContent = volume;
        row.cells[7].textContent = this.USDformatter.format(price);
    }

    updateTotalCost() {
        const total = Array.from(this.dataRows.querySelectorAll('tr'))
            .reduce((sum, row) => {
                const price = parseFloat(row.cells[7].textContent.replace(/[^0-9.-]+/g, '')) || 0;
                return sum + price;
            }, 0);

        const totalPriceCell = this.shadowRoot.getElementById('total-price');
        totalPriceCell.textContent = this.USDformatter.format(total);
    }

    submitWorksheet() {
        const data = Array.from(this.dataRows.querySelectorAll('tr')).map(row => ({
            _id: this.generateProductID({
                firingType: row.cells[0].querySelector('select').value,
                height: parseInt(row.cells[2].querySelector('input').value),
                width: parseInt(row.cells[3].querySelector('input').value),
                length: parseInt(row.cells[4].querySelector('input').value)
            }),
            firingType: row.cells[0].querySelector('select').value,
            unitCost: parseFloat(row.cells[1].textContent.replace(/[^0-9.-]+/g, '')),
            height: parseInt(row.cells[2].querySelector('input').value),
            width: parseInt(row.cells[3].querySelector('input').value),
            length: parseInt(row.cells[4].querySelector('input').value),
            volume: parseInt(row.cells[5].textContent),
            quantity: parseInt(row.cells[6].querySelector('input').value),
            price: parseFloat(row.cells[7].textContent.replace(/[^0-9.-]+/g, '')),
            dueDate: row.cells[8].querySelector('input').value || null,
            specialDirections: row.cells[9].querySelector('textarea').value || null
        }));

        this.dispatchEvent(new CustomEvent('submitWorksheet', {
            detail: { data }
        }));
    }

    generateProductID({ firingType, height, width, length }) {
        const rawID = `${firingType}-${height}-${width}-${length}`;
        let hash = 0;
        for (let i = 0; i < rawID.length; i++) {
            hash = (hash << 5) - hash + rawID.charCodeAt(i);
            hash |= 0;
        }
        return `${Math.abs(hash)}`;
    }
}

customElements.define('ceramics-firing-calculator', CeramicsFiringCalculator);
