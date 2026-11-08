import { createRequire } from "node:module";

// The integration server shares the configured database; it must not run
// production schedulers or claim unrelated outbox work during the test.
const require = createRequire(new URL("../../../Backend-Blog/package.json", import.meta.url));
const { ScheduleModule } = require("@nestjs/schedule");
const original = ScheduleModule.forRoot.bind(ScheduleModule);
ScheduleModule.forRoot = () => original({ cronJobs: false, intervals: false, timeouts: false });
