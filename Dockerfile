ARG ARCH

FROM ${ARCH}node:22 AS node
FROM ${ARCH}ossrs/srs:5 AS srs

RUN mv /usr/local/srs/objs/ffmpeg/bin/ffmpeg /usr/local/bin/ffmpeg && \
    ln -sf /usr/local/bin/ffmpeg /usr/local/srs/objs/ffmpeg/bin/ffmpeg

RUN rm -rf /usr/local/srs/objs/nginx/html/console \
    /usr/local/srs/objs/nginx/html/players

FROM ${ARCH}ossrs/srs:ubuntu20 AS build

ARG BUILDPLATFORM
ARG TARGETPLATFORM
ARG TARGETARCH
ARG MAKEARGS
RUN echo "BUILDPLATFORM: $BUILDPLATFORM, TARGETPLATFORM: $TARGETPLATFORM, TARGETARCH: $TARGETARCH, MAKEARGS: $MAKEARGS"

# For ui build.
COPY --from=node /usr/local/bin /usr/local/bin
COPY --from=node /usr/local/lib /usr/local/lib
# For SRS server, always use the latest release version.
COPY --from=srs /usr/local/srs /usr/local/srs

ADD releases /g/releases
ADD mgmt /g/mgmt
ADD platform /g/platform
ADD ui /g/ui
ADD usr /g/usr
ADD test /g/test
ADD Makefile /g/Makefile

# For node to use more memory to fix: JavaScript heap out of memory
ENV NODE_OPTIONS="--max-old-space-size=4096"

# By default, make all, including platform and ui, but it will take a long time,
# so there is a MAKEARGS to build without UI, see platform.yml.
WORKDIR /g
# We define SRS_NO_LINT to disable the lint check.
RUN export SRS_NO_LINT=1 && \
    make clean && make -j ${MAKEARGS} && make install

# Use UPX to compress the binary.
# https://serverfault.com/questions/949991/how-to-install-tzdata-on-a-ubuntu-docker-image
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get install -y upx curl xz-utils

RUN echo "Before UPX for $TARGETARCH" && \
    ls -lh /usr/local/srs/objs/srs /usr/local/oryx/platform/platform && \
    upx --best --lzma /usr/local/srs/objs/srs && \
    upx --best --lzma /usr/local/oryx/platform/platform && \
    echo "After UPX for $TARGETARCH" && \
    ls -lh /usr/local/srs/objs/srs /usr/local/oryx/platform/platform

# Install an up-to-date, self-contained FFmpeg (the base images bundle an old
# 5.0.2). It's a fully static amd64 build, so it has no runtime deps. To update,
# bump FFMPEG_URL (or pass --build-arg); the default tracks the latest build, so
# a fresh image build picks up the current FFmpeg automatically.
#
# Source: BtbN/FFmpeg-Builds on GitHub. We use GitHub (not johnvansickle.com)
# because that host blocks datacenter/CI IP ranges — curl from GitHub Actions
# runners gets HTTP 415, which is unrecoverable. GitHub's release CDN is reachable
# from CI. Extraction is layout-agnostic (find the binaries) so FFMPEG_URL can be
# overridden to either source. Alternative: https://johnvansickle.com/ffmpeg/
ARG FFMPEG_URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz"
RUN set -eux; \
    curl -fsSL --retry 5 --retry-delay 3 --retry-connrefused -A "Mozilla/5.0" "$FFMPEG_URL" -o /tmp/ffmpeg.tar.xz; \
    mkdir -p /tmp/ffmpeg; \
    tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg; \
    ffmpeg_bin="$(find /tmp/ffmpeg -type f -name ffmpeg | head -n1)"; \
    ffprobe_bin="$(find /tmp/ffmpeg -type f -name ffprobe | head -n1)"; \
    install -m 0755 "$ffmpeg_bin"  /usr/local/bin/ffmpeg; \
    install -m 0755 "$ffprobe_bin" /usr/local/bin/ffprobe; \
    rm -rf /tmp/ffmpeg /tmp/ffmpeg.tar.xz; \
    /usr/local/bin/ffmpeg -version | head -n1

# http://releases.ubuntu.com/focal/
#FROM ${ARCH}ubuntu:focal AS dist
FROM ${ARCH}ossrs/oryx:focal-1 AS dist

# Expose ports @see https://github.com/ossrs/oryx/blob/main/DEVELOPER.md#docker-allocated-ports
EXPOSE 2022 2443 1935 8080 5060 9000 8000/udp 10080/udp

# Copy files from build.
COPY --from=build /usr/local/oryx /usr/local/oryx
COPY --from=build /usr/local/srs /usr/local/srs

# Override the base image's bundled FFmpeg (5.0.2) with the updated build, and
# point SRS at it. The platform invokes "ffmpeg" from PATH (/usr/local/bin).
COPY --from=build /usr/local/bin/ffmpeg  /usr/local/bin/ffmpeg
COPY --from=build /usr/local/bin/ffprobe /usr/local/bin/ffprobe
RUN ln -sf /usr/local/bin/ffmpeg /usr/local/srs/objs/ffmpeg/bin/ffmpeg

# Prepare data directory.
RUN mkdir -p /data && \
    cd /usr/local/oryx/platform/containers && \
    rm -rf data && ln -sf /data .

CMD ["./bootstrap"]
