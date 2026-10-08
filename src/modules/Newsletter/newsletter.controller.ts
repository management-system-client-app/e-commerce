import type { Response } from "express";
import type { ValidatedRequest } from "../../app/middlewares/validateRequest";
import { newsletterService } from "./newsletter.service";
import type { NewsletterIdParam, SubscribeNewsletterInput } from "./newsletter.validation";

const subscribe = async (
  req: ValidatedRequest<SubscribeNewsletterInput>,
  res: Response,
): Promise<void> => {
  const subscriber = await newsletterService.subscribe(req.validatedBody.email);

  res.status(200).json({
    success: true,
    message: "Subscribed",
    data: { id: subscriber.id, email: subscriber.email },
  });
};

const getSubscribers = async (_req: ValidatedRequest, res: Response): Promise<void> => {
  const subscribers = await newsletterService.getSubscribers();

  res.status(200).json({
    success: true,
    message: "Subscribers fetched",
    data: subscribers,
  });
};

const removeSubscriber = async (
  req: ValidatedRequest<unknown, NewsletterIdParam>,
  res: Response,
): Promise<void> => {
  await newsletterService.removeSubscriber(req.validatedParams.id);

  res.status(200).json({
    success: true,
    message: "Subscriber removed",
  });
};

export const newsletterController = {
  subscribe,
  getSubscribers,
  removeSubscriber,
};
