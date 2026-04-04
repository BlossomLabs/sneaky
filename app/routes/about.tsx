import { Link } from "react-router"
import { Button } from "~/components/ui/button"

export default function About() {
  return (
    <div className="flex min-h-svh flex-col gap-4 p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <h1 className="font-medium">About</h1>
        <p>This route uses React Router.</p>
        <Button variant="outline" asChild>
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  )
}
