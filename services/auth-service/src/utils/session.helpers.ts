import { Request } from "express";
import { UAParser } from "ua-parser-js";

export function getSessionDetails(req: Request) {
    const parser = new UAParser(req.headers['user-agent']);

    const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
    const deviceInfo = `${parser.getBrowser().name ?? 'Unknown Browser'} on ${parser.getOS().name ?? 'Unknown OS'} (${parser.getDevice().type ?? 'desktop'})`;

    return { ipAddress, deviceInfo };
}