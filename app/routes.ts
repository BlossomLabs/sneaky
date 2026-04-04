import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("wallet", "routes/wallet.tsx"),
] satisfies RouteConfig
