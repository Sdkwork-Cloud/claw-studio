export {
  getSharedOpenClawGatewayClient,
} from '../openclaw/openClawGatewayClientRegistry.ts';
export {
  OpenClawGatewayClient,
  type OpenClawGatewayConnectionEvent,
} from '../openclaw/openClawGatewayClient.ts';
export type {
  OpenClawGatewayChatEvent,
  OpenClawGatewayChatHistoryResult,
  OpenClawGatewayHelloOk,
  OpenClawGatewayModelsListResult,
  OpenClawGatewaySessionsPatchResult,
  OpenClawGatewaySessionsListResult,
} from '../openclaw/gatewayProtocol.ts';
export {
  isGatewayMethodUnavailableError,
  resolveGatewayMethodSupport,
} from '../openclaw/gatewayProtocol.ts';
export {
  resolveInstanceChatRoute,
  type InstanceChatRouteMode,
} from '../instanceChatRouteService.ts';
export {
  buildGatewayAttachments,
  composeOutgoingChatText,
  deriveUserMessageTitle,
} from '../chatComposerAttachments.ts';
