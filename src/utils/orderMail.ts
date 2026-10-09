import logger from "../config/logger";

export const sendOrderMail = async (send: () => Promise<void>): Promise<boolean> => {
  try {
    await send();
    return true;
  } catch (error) {
    logger.error("Order email failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
};
