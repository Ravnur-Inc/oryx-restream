#!/bin/bash

# Execute by: bash xxx.sh or bash zzz/yyy/xxx.sh or ./xxx.sh or ./zzz/yyy/xxx.sh source xxx.sh
REALPATH=$(realpath ${BASH_SOURCE[0]})
SCRIPT_DIR=$(cd $(dirname ${REALPATH}) && pwd)
WORK_DIR=$(cd $(dirname ${REALPATH})/../.. && pwd)
cd ${WORK_DIR}

# Check OS, must be darwin.
OS=$(uname -s)
if [[ ${OS} != Darwin ]]; then
    echo "Must run on macOS, current os is ${OS}"
    exit 1
fi

HELP=no
TARGET=all
BUILD=yes

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help) HELP=yes; shift ;;
        --target) TARGET=$2; shift 2;;
        --build) BUILD=$2; shift 2;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
done

if [[ "$HELP" == yes ]]; then
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -h, --help    Show this help message and exit"
    echo "  --target      Test special target: all, script. default: $TARGET"
    echo "  --build       Whether build image. yes or no. default: $BUILD"
    exit 0
fi

if [[ $TARGET != all && $TARGET != script ]]; then
    echo "Unknown target $TARGET, should be script or all"
    exit 1
fi

CONTAINERS="script"
echo "Test TARGET=$TARGET, CONTAINERS=$CONTAINERS"

echo "Remove all docker containers"
docker rm -f $CONTAINERS 2>/dev/null || echo 'OK'
echo "Remove all docker containers OK"

#####################################################################################
if [[ $BUILD != no ]]; then
    echo "Rebuild platform docker image" &&
    docker rmi platform:latest 2>/dev/null || echo OK &&
    docker build -t platform:latest -f Dockerfile . &&
    docker save -o platform.tar platform:latest
    ret=$?; if [[ 0 -ne ${ret} ]]; then echo "Rebuild platform docker image failed, ret=$ret"; exit $ret; fi
fi

#####################################################################################
if [[ $TARGET == all || $TARGET == script ]]; then
    echo "Test script installer"

    echo "Build script dev docker image"
    docker rmi srs-script-dev 2>/dev/null || echo 'OK' &&
    docker build -t srs-script-dev -f scripts/setup-ubuntu/Dockerfile.script .
    ret=$?; if [[ 0 -ne ${ret} ]]; then echo "Build script dev docker image failed, ret=$ret"; exit $ret; fi

    echo "Run script dev docker image" &&
    docker rm -f $CONTAINERS 2>/dev/null || echo 'OK' &&
    docker run -p 2022:2022 -p 1935:1935/tcp -p 8000:8000/udp -p 10080:10080/udp \
        --privileged -v /sys/fs/cgroup:/sys/fs/cgroup:rw --cgroupns=host \
        -d --rm -it -v $(pwd):/g -w /g --name=script srs-script-dev &&
    echo "Waiting for the container to be ready..." && sleep 3 && echo "OK"
    ret=$?; if [[ 0 -ne ${ret} ]]; then echo "Run script dev docker image failed, ret=$ret"; exit $ret; fi

    echo "Load platform image to docker" &&
    version=$(bash scripts/version.sh) &&
    docker exec -it script docker load -i platform.tar &&
    docker exec -it script docker tag platform:latest ossrs/oryx:$version &&
    docker exec -it script docker tag platform:latest registry.cn-hangzhou.aliyuncs.com/ossrs/oryx:$version &&
    docker exec -it script docker images
    ret=$?; if [[ 0 -ne ${ret} ]]; then echo "Load platform image to docker failed, ret=$ret"; exit $ret; fi

    echo "Setup script installer" &&
    docker exec -it script rm -f /data/config/.env &&
    docker exec -it script bash build/oryx/scripts/setup-ubuntu/uninstall.sh || echo OK &&
    bash scripts/setup-ubuntu/build.sh --output $(pwd)/build --extract &&
    docker exec -it script bash build/oryx/scripts/setup-ubuntu/install.sh --verbose
    ret=$?; if [[ 0 -ne ${ret} ]]; then echo "Setup script installer failed, ret=$ret"; exit $ret; fi

    echo "Test script installer" &&
    docker exec -it script make -j -C test &&
    bash scripts/tools/secret.sh --output test/.env &&
    docker exec -it script ./test/oryx.test -test.v -endpoint http://localhost:2022 \
        -srs-log=true -wait-ready=true -init-password=true -init-self-signed-cert=true \
        -check-api-secret=true &&
    bash scripts/tools/secret.sh --output test/.env &&
    docker exec -it script ./test/oryx.test -test.v -wait-ready -endpoint https://localhost:2443 \
        -srs-log=true -wait-ready=true -init-password=false -init-self-signed-cert=false \
        -check-api-secret=true
    ret=$?; if [[ 0 -ne ${ret} ]]; then echo "Test script installer failed, ret=$ret"; exit $ret; fi

    echo "Test script installer OK"
fi

#####################################################################################
docker rm -f $CONTAINERS 2>/dev/null

echo ""
echo "All tests OK"
