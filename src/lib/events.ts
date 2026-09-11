import { EventEmitter } from 'events';

export interface OrderCreatedEvent {
  orderId: string;
}

export interface AuctionSettledEvent {
  auctionId: string;
  orderId?: string;
  winningBid?: number;
  winnerId?: string;
  sellerId: string;
}

export interface WalletTransferredEvent {
  fromUserId: string;
  toUserId: string;
  amount: number;
  transferRef: string;
  note?: string;
  senderBalance?: number;
}

export interface DisputeResolvedEvent {
  orderId: string;
  decision: 'REFUND_BUYER' | 'RELEASE_SELLER';
  resolutionNote: string;
}

export interface DomainEventsMap {
  'order:created': OrderCreatedEvent;
  'auction:settled': AuctionSettledEvent;
  'wallet:transferred': WalletTransferredEvent;
  'dispute:resolved': DisputeResolvedEvent;
}

class DomainEventEmitter extends EventEmitter {
  emit<K extends keyof DomainEventsMap>(event: K, payload: DomainEventsMap[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof DomainEventsMap>(event: K, listener: (payload: DomainEventsMap[K]) => void): this {
    return super.on(event, listener);
  }

  once<K extends keyof DomainEventsMap>(event: K, listener: (payload: DomainEventsMap[K]) => void): this {
    return super.once(event, listener);
  }
}

export const domainEvents = new DomainEventEmitter();
