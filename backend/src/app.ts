import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import routes from "./routes/index.js";

export const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "iPARK backend is running",
  });
});

app.use("/api", routes);
app.use(errorMiddleware);
