import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  index("routes/landing.tsx"),
  route("app", "routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("wallet", "routes/wallet.tsx"),
] satisfies RouteConfig
