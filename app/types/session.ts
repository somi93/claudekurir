export type SessionStatus = "available" | "reserved" | "completed" | "no-show";

export type WorkSession = {
  id: number;
  date: string; // "2026-08-03"
  startTime: string; // "09:00"
  endTime: string; // "13:00"
  zone: string;
  highDemand: boolean;
  status: SessionStatus;
  offeredForSwap?: boolean;
};

export type WorkSessionDto = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  zone: string;
  high_demand: boolean;
  status: SessionStatus;
  offered_for_swap?: boolean;
};

export type CourierSessionsResponse = {
  success: boolean;
  data: {
    available: WorkSessionDto[];
    mine: WorkSessionDto[];
  };
};

export type CourierSessions = {
  available: WorkSession[];
  mine: WorkSession[];
};
