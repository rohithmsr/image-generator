import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("job/:id", "routes/job-detail.tsx"),
] satisfies RouteConfig;
