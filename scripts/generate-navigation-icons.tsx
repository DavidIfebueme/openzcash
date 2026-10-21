/** Compile the portal icon components to static SVG for the isolated chat document. */
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ICON_BY_KEY, NavigationIcon } from "../src/components/navigation-icon";

const icons = Object.fromEntries(Object.keys(ICON_BY_KEY).map(name => [name,
  renderToStaticMarkup(<NavigationIcon name={name} />),
]));
writeFileSync(new URL("../src/lib/navigation-icons.generated.json", import.meta.url), JSON.stringify(icons, null, 2) + "\n");
