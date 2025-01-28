import { Permissions, webMethod } from "wix-web-module";
import { currentCart, cart } from "wix-ecom-backend";
import { elevate } from "wix-auth";
import { mediaManager } from "wix-media-backend";

const APP_ID = "97ed05e3-04ed-4095-af45-90587bfed9f0";

/**
 * Adds a worksheet's details to the current shopping cart.
 * @param {Array} worksheetData - Array of worksheet data to be added to the cart.
 * @returns {Promise<Object>} - Updated cart data.
 */
export const addWorksheetToCart = webMethod(
    Permissions.Anyone,
    async (worksheetData) => {
        try {
            console.log("Processing worksheet data:", worksheetData);
            return await generateCustomLineItemsFromWorksheet(worksheetData);
        } catch (error) {
            console.error("Error adding worksheet to cart:", error);
            throw new Error("Failed to add worksheet to cart");
        }
    }
);

/**
 * Uploads an image to the Wix Media Manager.
 * @param {string} buffer64 - Base64 string of the image buffer.
 * @returns {Promise<Object>} - Uploaded media details.
 */
export const uploadImage = webMethod(Permissions.Anyone, async (buffer64) => {
    const buffer = Buffer.from(buffer64, "base64");
    return mediaManager.upload(
        "/firing-worksheet-Uploads",
        buffer,
        "myFileName.png", {
            mediaOptions: {
                mimeType: "image/png",
                mediaType: "image",
            },
        }
    );
});

/**
 * Generates custom line items from worksheet data and adds them to the cart.
 * @param {Array} worksheetData - Array of worksheet data to be processed.
 * @returns {Promise<Object>} - Updated or newly created cart.
 */
async function generateCustomLineItemsFromWorksheet(worksheetData) {
    try {
        const elevatedGetCurrentCart = elevate(currentCart.getCurrentCart);
        const existingCart = await elevatedGetCurrentCart();

        // Process worksheet data into custom line items
        const customLineItems = await processWorksheetData(worksheetData);
        if (!existingCart) {
            // Create a new cart if none exists
            const elevatedCreateCart = elevate(cart.createCart);
            const newCart = await elevatedCreateCart({ customLineItems });
            return newCart;
        } else {
            // Update the existing cart
            const firingItems = existingCart.lineItems.filter(
                (item) => item.itemType.custom === "custom"
            );
            const firingItemIds = firingItems.map((item) => item._id);

            const elevatedAddToCart = elevate(currentCart.addToCurrentCart);
            if (firingItemIds.length) {
                await currentCart.removeLineItemsFromCurrentCart(firingItemIds);
            }

            const updatedCart = await elevatedAddToCart({ customLineItems });
            return updatedCart;
        }
    } catch (error) {
        console.error("Error generating custom line items:", error);

        // Fallback: Create a new cart with the provided worksheet data
        return await handleFallbackCartCreation(worksheetData);
    }
}

/**
 * Processes worksheet data into custom line items for the cart.
 * @param {Array} worksheetData - Array of worksheet data to be processed.
 * @returns {Promise<Array>} - Array of custom line items.
 */
async function processWorksheetData(worksheetData) {
    return Promise.all(
        worksheetData.map(async (item) => {
            let imgUrl = "";

            if (item.photoBuffer) {
                const imageData = await uploadImage(item.photoBuffer);
                imgUrl = imageData.fileUrl
            }
            return {
                itemType: { custom: "custom" },
                media: imgUrl,
                price: item.price.toString(),
                priceDescription: { original: item.price.toString() },
                descriptionLines: [{
                        name: { original: "Due Date" },
                        plainText: { original: item.dueDate },
                    },
                    {
                        name: { original: "Special Directions" },
                        plainText: { original: item?.specialDirections || "" },
                    },
                    {
                        name: { original: "Height" },
                        plainText: { original: item.height.toString() },
                    },
                    {
                        name: { original: "Width" },
                        plainText: { original: item.width.toString() },
                    },
                    {
                        name: { original: "Length" },
                        plainText: { original: item.length.toString() },
                    },
                ],
                productName: { original: item.firingType },
                catalogReference: {
                    appId: APP_ID,
                    catalogItemId: item._id,
                    options: {
                        Type: item.firingType,
                        Height: item.height.toString(),
                        Width: item.width.toString(),
                        Length: item.length.toString(),
                        Image: imgUrl,
                    },
                },
                quantity: item.quantity,
            };
        })
    );
}

/**
 * Handles fallback cart creation in case of errors.
 * @param {Array} worksheetData - Array of worksheet data for fallback.
 * @returns {Promise<Object>} - Newly created cart data.
 */
async function handleFallbackCartCreation(worksheetData) {
    try {
        const customLineItems = await processWorksheetData(worksheetData);
        const elevatedCreateCart = elevate(cart.createCart);
        const newCart = await elevatedCreateCart({ customLineItems });
        console.log("Fallback: New cart created:", newCart);
        return newCart;
    } catch (fallbackError) {
        console.error("Error during fallback cart creation:", fallbackError);
        throw new Error("Failed to create cart during fallback");
    }
}