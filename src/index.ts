import type { StandardSchemaV1 } from '@standard-schema/spec'
import PgBoss from 'pg-boss'

export class Boss<T extends StandardSchemaV1> {
  readonly boss: PgBoss
  private jobs: Job<T>[]

  constructor(connection: string) {
    this.boss = new PgBoss(connection)
    this.jobs = []
  }

  defineJob(jobName: string) {
    return new Job({
      jobName,
      boss: this.boss
    })
  }

  register(job: Job<T>) {
    this.jobs.push(job)

    return this
  }

  async start() {
    await this.boss.start()

    for (const job of this.jobs) {
      await job.start()
    }
  }
}

export class Job<T extends StandardSchemaV1> {
  private boss: PgBoss
  private jobName: string
  jobInput!: T
  private jobOptions?: PgBoss.SendOptions
  private handler?: (
    jobs: PgBoss.Job<StandardSchemaV1.InferInput<T>>[]
  ) => Promise<void>

  constructor({ boss, jobName }: { boss: PgBoss; jobName: string }) {
    this.boss = boss
    this.jobName = jobName
  }

  input<S extends StandardSchemaV1, Output = StandardSchemaV1.InferOutput<S>>(
    schema: S & (Output extends object ? unknown : never)
  ): Job<S> {
    const job = new Job<S>({
      boss: this.boss,
      jobName: this.jobName
    })

    job.jobInput = schema

    return job
  }

  options(options: PgBoss.SendOptions) {
    this.jobOptions = options

    return this
  }

  work(
    handler: (
      jobs: PgBoss.Job<StandardSchemaV1.InferInput<T>>[]
    ) => Promise<void>
  ) {
    this.handler = handler

    return this
  }

  private async workHandler(
    jobs: PgBoss.Job<StandardSchemaV1.InferInput<T>>[]
  ) {
    if (this.handler) {
      await this?.handler(jobs)
    }
  }

  async start(): Promise<void> {
    try {
      console.log(`Job ${this.jobName} starting...`)

      await this.boss.createQueue(this.jobName)

      const workId = await this.boss.work<StandardSchemaV1.InferInput<T>>(
        this.jobName,
        this.workHandler.bind(this)
      )

      console.log(`Job ${this.jobName} started successfully: ${workId}.`)
    } catch (error) {
      console.error(`Failed to start job ${this.jobName}:`, error)

      throw error
    }
  }

  async emit(input: StandardSchemaV1.InferInput<T>) {
    try {
      let result = this.jobInput['~standard'].validate(input)

      if (result instanceof Promise) result = await result

      if (result.issues) {
        throw new Error(JSON.stringify(result.issues, null, 2))
      }

      if (typeof result.value !== 'object' || result.value === null) {
        throw new Error('The input must be an object.')
      }

      const jobId = await this.boss.send(this.jobName, result.value, {
        ...this.jobOptions
      })

      if (!jobId) {
        throw new Error(
          `Failed to enqueue job ${this.jobName}: jobId is null or undefined`
        )
      }

      console.log(`Emitted job ${this.jobName} with ID: ${jobId}`)
    } catch (error) {
      console.error(`Failed to emit job ${this.jobName}:`, error)

      throw error
    }
  }
}
