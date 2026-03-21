import { getApi, postApi } from '../http/apiClient.ts';

const ACCOUNT_BASE_PATH = '/app/v3/api/account';

export interface AccountSummaryDto {
  cashAvailable?: number | string;
  cashFrozen?: number | string;
  pointsAvailable?: number;
  pointsFrozen?: number;
  tokenAvailable?: number;
  tokenFrozen?: number;
  hasPayPassword?: boolean;
}

export interface CashAccountInfoDto {
  accountId?: string;
  availableBalance?: number | string;
  frozenBalance?: number | string;
  totalBalance?: number | string;
  pendingBalance?: number | string;
  totalRecharged?: number | string;
  totalSpent?: number | string;
  totalWithdrawn?: number | string;
}

export interface AccountHistoryDto {
  historyId?: string;
  transactionType?: string;
  transactionTypeName?: string;
  amount?: number | string;
  transactionId?: string;
  remarks?: string;
  createdAt?: string;
  status?: string;
  statusName?: string;
}

export interface PageResult<T> {
  content?: T[];
  totalElements?: number;
  number?: number;
  size?: number;
}

export interface CashRechargeRequest {
  amount: number;
  paymentMethod: string;
  remarks?: string;
}

export interface CashWithdrawRequest {
  amount: number;
  withdrawMethod: string;
  remarks?: string;
}

export interface CashOperationResultDto {
  transactionId?: string;
  amount?: number | string;
  status?: string;
  paymentMethod?: string;
  withdrawMethod?: string;
  estimatedArrivalTime?: string;
}

export function getAccountSummary() {
  return getApi<AccountSummaryDto>(`${ACCOUNT_BASE_PATH}/summary`);
}

export function getCashAccount() {
  return getApi<CashAccountInfoDto>(`${ACCOUNT_BASE_PATH}/cash`);
}

export function getCashHistory() {
  return getApi<PageResult<AccountHistoryDto>>(`${ACCOUNT_BASE_PATH}/cash/history`);
}

export function rechargeCash(request: CashRechargeRequest) {
  return postApi<CashOperationResultDto>(`${ACCOUNT_BASE_PATH}/cash/recharge`, request);
}

export function withdrawCash(request: CashWithdrawRequest) {
  return postApi<CashOperationResultDto>(`${ACCOUNT_BASE_PATH}/cash/withdraw`, request);
}
