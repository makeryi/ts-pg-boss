# ts-pg-boss

Typesafe [pg-boss](https://github.com/timgit/pg-boss)

## Installation

```bash
npm i ts-pg-boss
```

## Usage

```typescript
import { Boss } from 'ts-pg-boss'
// You can use any validation library that implements Standard Schema. e.g. Zod / Valibot
import { z } from 'zod'

// 1. Create a pg-boss instance
const boss = new Boss('postgres://user:pass@host/database')

// 2. Define a job
const sendEmailJob = boss
  .defineJob('send-email')
  .input(
    z.object({
      email: z.string().email()
    })
  )
  .options({
    startAfter: 3,
    retryDelay: 1
  })
  .work(async (jobs) => {
    for (const job of jobs) {
      // Write your job logic here...
      console.log(job.data.email)
    }
  })

// 3. Register the jobs
boss.register(sendEmailJob).register(anotherJob)

// 4. Start the boss and jobs while your server start
await boss.start()

// 5. Emit a job in your server, e.g. In an API route
await sendEmailJob.emit({
  email: 'me@example.com'
})
```
