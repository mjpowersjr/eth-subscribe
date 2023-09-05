import { LogLevel } from 'fastify';
import {
    Logger as PinoLogger,
    pino,
} from 'pino';

export type Logger = PinoLogger;

export interface BuildLoggerInput {
    name: string;
    [key: string]: string | number | boolean | null | undefined;
}
const transport = {
    target: 'pino-pretty',
    options: { destination: 1 } // use 2 for stderr
};

const lfLogger = pino({
    // level: 'debug',
    transport,
});

export class LoggerFactory {

    private static logLevels: {
        [name: string]: LogLevel;
    } = {};

    static configure(config: { [name: string]: LogLevel }) {
        for (const name in config) {
            LoggerFactory.logLevels[name] = config[name];
        }

        lfLogger.debug({
            msg: 'configured log levels',
            levels: LoggerFactory.logLevels
        });
    }

    static build(input: BuildLoggerInput): Logger {
        const level = LoggerFactory.logLevels[input.name]
            || LoggerFactory.logLevels['default']
            || 'info';

        lfLogger.debug({
            msg: 'building logger',
            config: {
                level,
                base: input,
            }
        });

        const log = pino({
            base: input,
            transport,
            level,
            formatters: {
                level: (label) => {
                    return {
                        level: label
                    }
                },
            },
        });

        return log;
    }
}
