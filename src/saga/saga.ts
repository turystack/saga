import { LoggerService } from '@turystack/nestjs-logger'

/**
 * Saga orchestrator for managing distributed compensating transactions.
 *
 * Register compensation functions as you progress through a multi-step operation.
 * If any step fails, call {@link rollback} to execute compensations in reverse order.
 *
 * @example
 * ```ts
 * import { Saga } from '@turystack/saga'
 *
 * const saga = new Saga('CreateOrder')
 *
 * const order = await createOrder(data)
 * saga.addCompensation(() => deleteOrder(order.id))
 *
 * const payment = await chargePayment(order)
 * saga.addCompensation(() => refundPayment(payment.id))
 *
 * // If something fails later:
 * await saga.rollback() // refunds payment, then deletes order
 * ```
 */
export class Saga {
	private readonly _loggerService!: LoggerService
	private readonly _name: string

	private compensations: Array<() => Promise<unknown> | unknown> = []

	constructor(name: string) {
		this._loggerService = new LoggerService(name)
		this._name = name
	}

	/**
	 * Registers a compensation function to be executed on rollback.
	 * Compensations are executed in **reverse** order (LIFO).
	 */
	addCompensation(compensate: () => Promise<unknown> | unknown): void {
		this.compensations.unshift(compensate)
	}

	/**
	 * Executes all registered compensations in reverse order.
	 *
	 * Individual compensation failures are logged but do not stop
	 * the remaining compensations from executing.
	 */
	async rollback() {
		for (const compensate of this.compensations) {
			try {
				await compensate()

				this._loggerService.debug('Compensation executed', {
					name: this._name,
				})
			} catch (err) {
				this._loggerService.error('Compensation failed', {
					error: err,
					name: this._name,
				})
			}
		}

		this.compensations = []
	}
}
