import { defineApp } from "convex/server";
import { auth } from "@convex-dev/auth/server";

const app = defineApp();
app.use(auth);

export default app;
