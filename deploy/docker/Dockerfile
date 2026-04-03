FROM debian:bookworm-slim

WORKDIR /opt/claw

ENV CLAW_SERVER_HOST=0.0.0.0 \
    CLAW_SERVER_PORT=18797 \
    CLAW_SERVER_DATA_DIR=/var/lib/claw-server \
    CLAW_SERVER_WEB_DIST=/opt/claw/app/web/dist

COPY app ./app

RUN mkdir -p /var/lib/claw-server \
  && chmod +x /opt/claw/app/bin/sdkwork-claw-server \
  && chmod +x /opt/claw/app/start-claw-server.sh

EXPOSE 18797

CMD ["/bin/sh", "/opt/claw/app/start-claw-server.sh"]
