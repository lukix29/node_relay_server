'use strict';

Object.defineProperty(exports, '__esModule', {value: true});

class ElementHeader {
    constructor(id, size, offset, dataOffset) {
        this.id = id;
        this.size = size;
        this.offset = offset;
        this.dataOffset = dataOffset;
        this.end = dataOffset + size;
        this.status = true;
    }

    init(id, size, offset, dataOffset) {
        this.id = id;
        this.size = size;
        this.offset = offset;
        this.dataOffset = dataOffset;
        this.end = dataOffset + size;
        this.status = true;
    }

    reset() {
        this.status = false;
    }

    getData() {
        return {
            id: this.id,
            size: this.size,
            offset: this.offset,
            dataOffset: this.dataOffset,
            end: this.end
        };
    }
}

var ElementHeader_1 = ElementHeader;

class DateParser {
    constructor() {
    }
}

var DateParser_1 = DateParser;

var INITIAL_COUNTER = -1;

class DataInterface {
    constructor(demuxer) {
        this.demuxer = demuxer;
        this.overallPointer = 0;
        this.internalPointer = 0;
        this.currentBuffer = null;
        this.markerPointer = 0;
        this.tempFloat64 = new DataView(new ArrayBuffer(8));
        this.tempFloat32 = new DataView(new ArrayBuffer(4));
        this.tempBinaryBuffer = null;
        this.seekTarget;
        this.dateParser = new DateParser_1();
        Object.defineProperty(this, 'offset', {
            get: function () {
                return this.overallPointer;
            },
            set: function (offset) {
                this.overallPointer = offset;
            }
        });
        this.tempElementOffset = null;
        this.tempElementDataOffset = null;
        this.tempSize = null;
        this.tempOctetWidth = null;
        this.tempOctet = null;
        this.tempByteBuffer = 0;
        this.tempByteCounter = 0;
        this.tempElementId = null;
        this.tempElementSize = null;
        this.tempVintWidth = null;
        this.tempResult = null;
        this.tempCounter = INITIAL_COUNTER;
        this.usingBufferedRead = false;
        this.dataBuffers = [];
        Object.defineProperty(this, 'remainingBytes', {
            get: function () {
                if (!this.currentBuffer)
                    return 0;
                else
                    return this.currentBuffer.byteLength - this.internalPointer;
            }
        });
    }

    flush() {
        this.currentBuffer = null;
        this.tempElementOffset = null;
        this.tempElementDataOffset = null;
        this.tempSize = null;
        this.tempOctetWidth = null;
        this.tempOctet = null;
        this.tempByteBuffer = 0;
        this.tempByteCounter = 0;
        this.tempElementId = null;
        this.tempElementSize = null;
        this.tempVintWidth = null;
        this.tempBinaryBuffer = null;
        this.tempResult = null;
        this.tempCounter = INITIAL_COUNTER;
        this.usingBufferedRead = false;
        this.overallPointer = 0;
        this.internalPointer = 0;
        this.tempFloat64 = new DataView(new ArrayBuffer(8));
        this.tempFloat32 = new DataView(new ArrayBuffer(4));
    }

    recieveInput(data) {
        if (this.currentBuffer === null) {
            this.currentBuffer = new DataView(data);
            this.internalPointer = 0;
        } else {
            this.dataBuffers.push(new DataView(data));
        }
    }

    popBuffer() {
        if (this.remainingBytes === 0) {
            if (this.dataBuffers.length > 0) {
                this.currentBuffer = this.dataBuffers.shift();
            } else {
                this.currentBuffer = null;
            }
            this.internalPointer = 0;
        }
    }

    readDate(size) {
        return this.readSignedInt(size);
    }

    readId() {
        if (!this.currentBuffer)
            return null;
        if (!this.tempOctet) {
            if (!this.currentBuffer)
                return null;
            this.tempElementOffset = this.overallPointer;
            this.tempOctet = this.currentBuffer.getUint8(this.internalPointer);
            this.incrementPointers(1);
            this.tempOctetWidth = this.calculateOctetWidth();
            this.popBuffer();
        }
        var tempByte;
        if (!this.tempByteCounter)
            this.tempByteCounter = 0;
        while (this.tempByteCounter < this.tempOctetWidth) {
            if (!this.currentBuffer)
                return null;
            if (this.tempByteCounter === 0) {
                this.tempByteBuffer = this.tempOctet;
            } else {
                tempByte = this.readByte();
                this.tempByteBuffer = (this.tempByteBuffer << 8) | tempByte;
            }
            this.tempByteCounter++;
            this.popBuffer();
        }
        var result = this.tempByteBuffer;
        this.tempOctet = null;
        this.tempByteCounter = null;
        this.tempByteBuffer = null;
        this.tempOctetWidth = null;
        return result;
    }

    readLacingSize() {
        var vint = this.readVint();
        if (vint === null) {
            return null;
        } else {
            switch (this.lastOctetWidth) {
                case 1:
                    vint -= 63;
                    break;
                case 2:
                    vint -= 8191;
                    break;
                case 3:
                    vint -= 1048575;
                    break;
                case 4:
                    vint -= 134217727;
                    break;
            }
        }
        return vint;
    }

    readVint() {
        if (!this.currentBuffer)
            return null;
        if (!this.tempOctet) {
            if (!this.currentBuffer)
                return null;
            this.tempOctet = this.currentBuffer.getUint8(this.internalPointer);
            this.incrementPointers(1);
            this.tempOctetWidth = this.calculateOctetWidth();
            this.popBuffer();
        }
        if (!this.tempByteCounter)
            this.tempByteCounter = 0;
        var tempByte;
        var tempOctetWidth = this.tempOctetWidth;
        while (this.tempByteCounter < tempOctetWidth) {
            if (!this.currentBuffer)
                return null;
            if (this.tempByteCounter === 0) {
                var mask = ((0xFF << tempOctetWidth) & 0xFF) >> tempOctetWidth;
                this.tempByteBuffer = this.tempOctet & mask;
            } else {
                tempByte = this.readByte();
                this.tempByteBuffer = (this.tempByteBuffer << 8) | tempByte;
            }
            this.tempByteCounter++;
            this.popBuffer();
        }
        var result = this.tempByteBuffer;
        this.tempOctet = null;
        this.lastOctetWidth = this.tempOctetWidth;
        this.tempOctetWidth = null;
        this.tempByteCounter = null;
        this.tempByteBuffer = null;
        return result;
    }

    bufferedReadVint() {
        var tempByte;
        if (!this.tempByteCounter)
            this.tempByteCounter = 0;
        while (this.tempByteCounter < this.tempOctetWidth) {
            if (!this.currentBuffer)
                return null;
            if (this.tempByteCounter === 0) {
                var mask = ((0xFF << this.tempOctetWidth) & 0xFF) >> this.tempOctetWidth;
                this.tempByteBuffer = this.tempOctet & mask;
            } else {
                tempByte = this.readByte();
                this.tempByteBuffer = (this.tempByteBuffer << 8) | tempByte;
            }
            this.tempByteCounter++;
            this.popBuffer();
        }
        var result = this.tempByteBuffer;
        this.tempByteCounter = null;
        this.tempByteBuffer = null;
        return result;
    }

    clearTemps() {
        this.tempId = null;
        this.tempSize = null;
        this.tempOctetMask = null;
        this.tempOctetWidth = null;
        this.tempOctet = null;
        this.tempByteBuffer = 0;
        this.tempByteCounter = 0;
        this.usingBufferedRead = false;
    }

    forceReadVint() {
        var result;
        switch (this.tempOctetWidth) {
            case 1:
                result = this.tempOctet & 0x7F;
                break;
            case 2:
                result = this.tempOctet & 0x3F;
                result = (result << 8) | this.currentBuffer.getUint8(this.internalPointer);
                this.incrementPointers(1);
                break;
            case 3:
                result = this.tempOctet & 0x1F;
                result = (result << 16) | this.currentBuffer.getUint16(this.internalPointer);
                this.incrementPointers(2);
                break;
            case 4:
                result = this.tempOctet & 0x0F;
                result = (result << 16) | this.currentBuffer.getUint16(this.internalPointer);
                this.incrementPointers(2);
                result = (result << 8) | this.currentBuffer.getUint8(this.internalPointer);
                this.incrementPointers(1);
                break;
            case 5:
                console.warn("finish this");
                break;
            case 6:
                console.warn("finish this");
                break;
            case 7:
                console.warn("finish this");
                break;
            case 8:
                result = this.tempOctet & 0x00;
                result = (result << 8) | this.currentBuffer.getUint8(this.internalPointer);
                this.incrementPointers(1);
                result = (result << 16) | this.currentBuffer.getUint16(this.internalPointer);
                this.incrementPointers(2);
                result = (result << 32) | this.currentBuffer.getUint32(this.internalPointer);
                this.incrementPointers(4);
                break;
        }
        this.popBuffer();
        this.tempOctetWidth = null;
        this.tempOctet = null;
        return result;
    }

    readByte() {
        if (!this.currentBuffer) {
            console.error("READING OUT OF BOUNDS");
        }
        var byteToRead = this.currentBuffer.getUint8(this.internalPointer);
        this.incrementPointers(1);
        this.popBuffer();
        return byteToRead;
    }

    readSignedByte() {
        if (!this.currentBuffer)
            console.error('READING OUT OF BOUNDS');
        var byteToRead = this.currentBuffer.getInt8(this.internalPointer);
        this.incrementPointers(1);
        this.popBuffer();
        return byteToRead;
    }

    peekElement() {
        if (!this.currentBuffer)
            return null;
        if (!this.tempElementId) {
            this.tempElementId = this.readId();
            if (this.tempElementId === null)
                return null;
        }
        if (!this.tempElementSize) {
            this.tempElementSize = this.readVint();
            if (this.tempElementSize === null)
                return null;
        }
        var element = new ElementHeader_1(this.tempElementId, this.tempElementSize, this.tempElementOffset, this.overallPointer);
        this.tempElementId = null;
        this.tempElementSize = null;
        this.tempElementOffset = null;
        return element;
    }

    peekAndSetElement(element) {
        if (!this.currentBuffer)
            return null;
        if (!this.tempElementId) {
            this.tempElementId = this.readId();
            if (this.tempElementId === null)
                return null;
        }
        if (!this.tempElementSize) {
            this.tempElementSize = this.readVint();
            if (this.tempElementSize === null)
                return null;
        }
        element.init(this.tempElementId, this.tempElementSize, this.tempElementOffset, this.overallPointer);
        this.tempElementId = null;
        this.tempElementSize = null;
        this.tempElementOffset = null;
    }

    peekBytes(n) {
        if ((this.remainingBytes - n) >= 0)
            return true;
        return false;
    }

    skipBytes(bytesToSkip) {
        var chunkToErase = 0;
        if (this.tempCounter === INITIAL_COUNTER)
            this.tempCounter = 0;
        while (this.tempCounter < bytesToSkip) {
            if (!this.currentBuffer)
                return false;
            if ((bytesToSkip - this.tempCounter) > this.remainingBytes) {
                chunkToErase = this.remainingBytes;
            } else {
                chunkToErase = bytesToSkip - this.tempCounter;
            }
            this.incrementPointers(chunkToErase);
            this.popBuffer();
            this.tempCounter += chunkToErase;
        }
        this.tempCounter = INITIAL_COUNTER;
        return true;
    }

    getRemainingBytes() {
        if (!this.currentBuffer)
            return 0;
        return this.currentBuffer.byteLength - this.internalPointer;
    }

    calculateOctetWidth() {
        var leadingZeroes = 0;
        var zeroMask = 0x80;
        do {
            if (this.tempOctet & zeroMask)
                break;
            zeroMask = zeroMask >> 1;
            leadingZeroes++;
        } while (leadingZeroes < 8);
        return leadingZeroes + 1;
    }

    incrementPointers(n) {
        var bytesToAdd = n || 1;
        this.internalPointer += bytesToAdd;
        this.overallPointer += bytesToAdd;
    }

    readUnsignedInt(size) {
        if (!this.currentBuffer)
            return null;
        if (size <= 0 || size > 8) {
            console.warn("invalid file size");
        }
        if (this.tempResult === null)
            this.tempResult = 0;
        if (this.tempCounter === INITIAL_COUNTER)
            this.tempCounter = 0;
        var b;
        while (this.tempCounter < size) {
            if (!this.currentBuffer)
                return null;
            b = this.readByte();
            if (this.tempCounter === 0 && b < 0) {
                console.warn("invalid integer value");
            }
            this.tempResult <<= 8;
            this.tempResult |= b;
            this.popBuffer();
            this.tempCounter++;
        }
        var result = this.tempResult;
        this.tempResult = null;
        this.tempCounter = INITIAL_COUNTER;
        return result;
    }

    readSignedInt(size) {
        if (!this.currentBuffer)
            return null;
        if (size <= 0 || size > 8) {
            console.warn("invalid file size");
        }
        if (this.tempResult === null)
            this.tempResult = 0;
        if (this.tempCounter === INITIAL_COUNTER)
            this.tempCounter = 0;
        var b;
        while (this.tempCounter < size) {
            if (!this.currentBuffer)
                return null;
            if (this.tempCounter === 0)
                b = this.readByte();
            else
                b = this.readSignedByte();
            this.tempResult <<= 8;
            this.tempResult |= b;
            this.popBuffer();
            this.tempCounter++;
        }
        var result = this.tempResult;
        this.tempResult = null;
        this.tempCounter = INITIAL_COUNTER;
        return result;
    }

    readString(size) {
        if (!this.tempString)
            this.tempString = '';
        if (this.tempCounter === INITIAL_COUNTER)
            this.tempCounter = 0;
        var tempString = '';
        while (this.tempCounter < size) {
            if (!this.currentBuffer) {
                this.tempString += tempString;
                return null;
            }
            tempString += String.fromCharCode(this.readByte());
            this.popBuffer();
            this.tempCounter++;
        }
        this.tempString += tempString;
        var retString = this.tempString;
        this.tempString = null;
        this.tempCounter = INITIAL_COUNTER;
        return retString;
    }

    readFloat(size) {
        if (size === 8) {
            if (this.tempCounter === INITIAL_COUNTER)
                this.tempCounter = 0;
            if (this.tempResult === null) {
                this.tempResult = 0;
                this.tempFloat64.setFloat64(0, 0);
            }
            var b;
            while (this.tempCounter < size) {
                if (!this.currentBuffer)
                    return null;
                b = this.readByte();
                this.tempFloat64.setUint8(this.tempCounter, b);
                this.popBuffer();
                this.tempCounter++;
            }
            this.tempResult = this.tempFloat64.getFloat64(0);
        } else if (size === 4) {
            if (this.tempCounter === INITIAL_COUNTER)
                this.tempCounter = 0;
            if (this.tempResult === null) {
                this.tempResult = 0;
                this.tempFloat32.setFloat32(0, 0);
            }
            var b;
            while (this.tempCounter < size) {
                if (!this.currentBuffer)
                    return null;
                b = this.readByte();
                this.tempFloat32.setUint8(this.tempCounter, b);
                this.popBuffer();
                this.tempCounter++;
            }
            this.tempResult = this.tempFloat32.getFloat32(0);
        } else {
            throw "INVALID FLOAT LENGTH";
        }
        var result = this.tempResult;
        this.tempResult = null;
        this.tempCounter = INITIAL_COUNTER;
        return result;
    }

    getBinary(length) {
        if (!this.currentBuffer)
            return null;
        if (this.usingBufferedRead && this.tempCounter === null) {
            throw "COUNTER WAS ERASED";
        }
        if (this.remainingBytes >= length && !this.usingBufferedRead) {
            if (!this.currentBuffer)
                return null;
            var newBuffer = this.currentBuffer.buffer.slice(this.internalPointer, this.internalPointer + length);
            this.incrementPointers(length);
            this.popBuffer();
            return newBuffer;
        }
        var test = this.offset;
        var tempRemainingBytes = this.remainingBytes;
        if (this.usingBufferedRead === false && this.tempCounter > 0)
            throw "INVALID BUFFERED READ";
        this.usingBufferedRead = true;
        if (!this.tempBinaryBuffer)
            this.tempBinaryBuffer = new Uint8Array(length);
        if (this.tempCounter === INITIAL_COUNTER)
            this.tempCounter = 0;
        var bytesToCopy = 0;
        var tempBuffer;
        while (this.tempCounter < length) {
            if (!this.currentBuffer) {
                if (this.usingBufferedRead === false)
                    throw "HELLA WRONG";
                return null;
            }
            if ((length - this.tempCounter) >= this.remainingBytes) {
                bytesToCopy = this.remainingBytes;
            } else {
                bytesToCopy = length - this.tempCounter;
            }
            tempBuffer = new Uint8Array(this.currentBuffer.buffer, this.internalPointer, bytesToCopy);
            this.tempBinaryBuffer.set(tempBuffer, this.tempCounter);
            this.incrementPointers(bytesToCopy);
            this.popBuffer();
            this.tempCounter += bytesToCopy;
        }
        if (this.tempCounter !== length)
            console.warn("invalid read");
        var tempBinaryBuffer = this.tempBinaryBuffer;
        this.tempBinaryBuffer = null;
        this.tempCounter = INITIAL_COUNTER;
        this.usingBufferedRead = false;
        if (tempBinaryBuffer.buffer === null) {
            throw "Missing buffer";
        }
        return tempBinaryBuffer.buffer;
    }
}

var DataInterface_1 = DataInterface;

class Seek {
    constructor(seekHeader, dataInterface) {
        this.size = seekHeader.size;
        this.offset = seekHeader.offset;
        this.end = seekHeader.end;
        this.dataInterface = dataInterface;
        this.loaded = false;
        this.currentElement = null;
        this.seekId = -1;
        this.seekPosition = -1;
    }

    load() {
        while (this.dataInterface.offset < this.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0x53AB: {
                    const seekId = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (seekId !== null) {
                        this.seekId = seekId;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x53AC: {
                    const seekPosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (seekPosition !== null) {
                        this.seekPosition = seekPosition;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0xbf:
                    var crc = this.dataInterface.getBinary(this.currentElement.size);
                    if (crc !== null)
                        ;
                    else
                        return null;
                    break;
                default:
                    console.warn("Seek element not found, skipping : " + this.currentElement.id.toString(16));
                    break;
            }
            this.currentElement = null;
        }
        if (this.dataInterface.offset !== this.end)
            console.error("Invalid Seek Formatting");
        this.loaded = true;
    }
}

var Seek_1 = Seek;

class SeekHead {
    constructor(seekHeadHeader, dataInterface) {
        this.dataInterface = dataInterface;
        this.offset = seekHeadHeader.offset;
        this.size = seekHeadHeader.size;
        this.end = seekHeadHeader.end;
        this.entries = [];
        this.entryCount = 0;
        this.voidElements = [];
        this.voidElementCount = 0;
        this.loaded = false;
        this.tempEntry = null;
        this.currentElement = null;
    }

    load() {
        var end = this.end;
        while (this.dataInterface.offset < end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0x4DBB:
                    if (!this.tempEntry)
                        this.tempEntry = new Seek_1(this.currentElement, this.dataInterface);
                    this.tempEntry.load();
                    if (!this.tempEntry.loaded)
                        return;
                    else
                        this.entries.push(this.tempEntry);
                    break;
                case 0xbf:
                    var crc = this.dataInterface.getBinary(this.currentElement.size);
                    if (crc !== null)
                        ;
                    else
                        return null;
                    break;
                default:
                    console.warn("Seek head element not found, skipping : " + this.currentElement.id.toString(16));
                    break;
            }
            this.tempEntry = null;
            this.currentElement = null;
        }
        if (this.dataInterface.offset !== this.end) {
            console.log(this);
            throw "INVALID SEEKHEAD FORMATTING"
        }
        this.loaded = true;
    }
}

var SeekHead_1 = SeekHead;

class SegmentInfo {
    constructor(infoHeader, dataInterface) {
        this.dataInterface = dataInterface;
        this.offset = infoHeader.offset;
        this.size = infoHeader.size;
        this.end = infoHeader.end;
        this.muxingApp = null;
        this.writingApp = null;
        this.title = null;
        this.dataOffset = null;
        this.timecodeScale = 1000000;
        this.duration = -1;
        this.loaded = false;
        this.segmentUID = null;
        this.duration = null;
        this.dateUTC;
    }

    load() {
        var end = this.end;
        while (this.dataInterface.offset < end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0x2AD7B1: {
                    var timecodeScale = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (timecodeScale !== null) {
                        this.timecodeScale = timecodeScale;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x4D80:
                    var muxingApp = this.dataInterface.readString(this.currentElement.size);
                    if (muxingApp !== null)
                        this.muxingApp = muxingApp;
                    else
                        return null;
                    break;
                case 0x5741:
                    var writingApp = this.dataInterface.readString(this.currentElement.size);
                    if (writingApp !== null)
                        this.writingApp = writingApp;
                    else
                        return null;
                    break;
                case 0x7BA9:
                    var title = this.dataInterface.readString(this.currentElement.size);
                    if (title !== null)
                        this.title = title;
                    else
                        return null;
                    break;
                case 0x73A4:
                    var segmentUID = this.dataInterface.readString(this.currentElement.size);
                    if (segmentUID !== null)
                        this.segmentUID = segmentUID;
                    else
                        return null;
                    break;
                case 0x4489:
                    var duration = this.dataInterface.readFloat(this.currentElement.size);
                    if (duration !== null)
                        this.duration = duration;
                    else
                        return null;
                    break;
                case 0x4461:
                    var dateUTC = this.dataInterface.readDate(this.currentElement.size);
                    if (dateUTC !== null)
                        this.dateUTC = dateUTC;
                    else
                        return null;
                    break;
                case 0xbf:
                    var crc = this.dataInterface.getBinary(this.currentElement.size);
                    if (crc !== null)
                        ;
                    else
                        return null;
                    break;
                default:
                    console.error("Ifno element not found, skipping : " + this.currentElement.id.toString(16));
                    break;
            }
            this.currentElement = null;
        }
        if (this.dataInterface.offset !== this.end) {
            throw new Error('Invalid SegmentInfo Formatting');
        }
        this.loaded = true;
    }
}

var SegmentInfo_1 = SegmentInfo;

class Track {
    loadMeta(meta) {
        for (const key in meta) {
            this[key] = meta[key];
        }
    }
}

var Track_1 = Track;

class AudioTrack extends Track_1 {
    constructor(trackHeader, dataInterface) {
        super();
        this.dataInterface = dataInterface;
        this.offset = trackHeader.offset;
        this.size = trackHeader.size;
        this.end = trackHeader.end;
        this.loaded = false;
        this.rate = null;
        this.channel = null;
        this.bitDepth = null;
    }

    load() {
        while (this.dataInterface.offset < this.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null) return null;
            }
            switch (this.currentElement.id) {
                case 0xB5:
                    var rate = this.dataInterface.readFloat(this.currentElement.size);
                    if (rate !== null) this.rate = rate;
                    else
                        return null;
                    break;
                case 0x9F:
                    var channels = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (channels !== null) this.channels = channels;
                    else
                        return null;
                    break;
                case 0x6264:
                    var bitDepth = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (bitDepth !== null)
                        this.bitDepth = bitDepth;
                    else
                        return null;
                    break;
                default:
                    console.warn("Ifno element not found, skipping");
                    break;
            }
            this.currentElement = null;
        }
        this.loaded = true;
    }
}

var AudioTrack_1 = AudioTrack;

class VideoTrack extends Track_1 {
    constructor(trackHeader, dataInterface) {
        super();
        this.dataInterface = dataInterface;
        this.offset = trackHeader.offset;
        this.size = trackHeader.size;
        this.end = trackHeader.end;
        this.loaded = false;
        this.width = null;
        this.height = null;
        this.displayWidth = null;
        this.displayHeight = null;
        this.displayUnit = 0;
        this.stereoMode = null;
        this.frameRate = null;
        this.pixelCropBottom = 0;
        this.pixelCropTop = 0;
        this.pixelCropLeft = 0;
        this.pixelCropRight = 0;
    }

    load() {
        while (this.dataInterface.offset < this.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null) return null;
            }
            switch (this.currentElement.id) {
                case 0xB0: {
                    const width = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (width !== null) {
                        this.width = width;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0xBA: {
                    const height = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (height !== null) {
                        this.height = height;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x54B0: {
                    const displayWidth = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (displayWidth !== null) {
                        this.displayWidth = displayWidth;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x54BA: {
                    const displayHeight = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (displayHeight !== null) {
                        this.displayHeight = displayHeight;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x54B2: {
                    const displayUnit = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (displayUnit !== null) {
                        this.displayUnit = displayUnit;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x53B8: {
                    const stereoMode = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (stereoMode !== null) {
                        this.stereoMode = stereoMode;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x2383E3: {
                    const frameRate = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (frameRate !== null) {
                        this.frameRate = frameRate;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x9A: {
                    const flagInterlaced = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (flagInterlaced !== null) {
                        this.flagInterlaced = flagInterlaced;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x55B0: {
                    const colours = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    break;
                }
                default:
                    console.warn(`Info element not found, skipping: ${this.currentElement.id.toString(16)}`);
                    break;
            }
            this.currentElement = null;
        }
        if (!this.displayWidth) {
            this.displayWidth = this.width - this.pixelCropLeft;
        }
        if (!this.displayHeight) {
            this.displayHeight = this.height - this.pixelCropTop;
        }
        this.loaded = true;
    }
}

var VideoTrack_1 = VideoTrack;

class Tracks {
    constructor(seekHeadHeader, dataInterface, demuxer) {
        this.demuxer = demuxer;
        this.dataInterface = dataInterface;
        this.offset = seekHeadHeader.offset;
        this.size = seekHeadHeader.size;
        this.end = seekHeadHeader.end;
        this.trackEntries = [];
        this.loaded = false;
        this.tempEntry = null;
        this.currentElement = null;
        this.trackLoader = null;
    }

    load() {
        while (this.dataInterface.offset < this.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0xAE:
                    if (!this.trackLoader)
                        this.trackLoader = new TrackLoader(this.currentElement, this.dataInterface);
                    this.trackLoader.load();
                    if (!this.trackLoader.loaded)
                        return;
                    else {
                        var trackEntry = this.trackLoader.getTrackEntry();
                        this.trackLoader = null;
                    }
                    this.trackEntries.push(trackEntry);
                    break;
                case 0xbf:
                    var crc = this.dataInterface.getBinary(this.currentElement.size);
                    if (crc !== null)
                        ;
                    else
                        return null;
                    break;
                default:
                    console.warn("track element not found, skipping : " + this.currentElement.id.toString(16));
                    break;
            }
            this.currentElement = null;
        }
        this.loaded = true;
    }

    loadTrackEntry() {
        if (!this.tempEntry) {
            this.tempEntry = new Seek_1(this.currentElement, this.dataInterface);
        }
    }
}

class TrackLoader {
    constructor(trackheader, dataInterface) {
        this.dataInterface = dataInterface;
        this.offset = trackheader.offset;
        this.size = trackheader.size;
        this.end = trackheader.end;
        this.loaded = false;
        this.loading = true;
        this.trackData = {};
        this.trackData.trackNumber = null;
        this.trackData.trackType = null;
        this.trackData.name = null;
        this.trackData.codecName = null;
        this.trackData.defaultDuration = null;
        this.trackData.codecID = null;
        this.trackData.lacing = null;
        this.trackData.codecPrivate = null;
        this.trackData.codecDelay = null;
        this.trackData.seekPreRoll = null;
        this.trackData.trackUID = null;
        this.tempTrack = null;
        this.minCache = null;
    }

    load() {
        const end = this.end;
        while (this.dataInterface.offset < end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null) return null;
            }
            switch (this.currentElement.id) {
                case 0xE0:
                    if (!this.tempTrack)
                        this.tempTrack = new VideoTrack_1(this.currentElement, this.dataInterface);
                    this.tempTrack.load();
                    if (!this.tempTrack.loaded) return;
                    break;
                case 0xE1:
                    if (!this.tempTrack)
                        this.tempTrack = new AudioTrack_1(this.currentElement, this.dataInterface);
                    this.tempTrack.load();
                    if (!this.tempTrack.loaded) return;
                    break;
                case 0xD7: {
                    const trackNumber = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (trackNumber !== null) {
                        this.trackData.trackNumber = trackNumber;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x83: {
                    const trackType = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (trackType !== null) {
                        this.trackData.trackType = trackType;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x536E: {
                    const name = this.dataInterface.readString(this.currentElement.size);
                    if (name !== null) {
                        this.trackData.name = name;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x258688: {
                    const codecName = this.dataInterface.readString(this.currentElement.size);
                    if (codecName !== null) {
                        this.trackData.codecName = codecName;
                    } else {
                        return null;
                    }
                    break;
                }
                case 0x22B59C:
                    var language = this.dataInterface.readString(this.currentElement.size);
                    if (language !== null)
                        this.trackData.language = language;
                    else
                        return null;
                    break;
                case 0x23E383:
                    var defaultDuration = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (defaultDuration !== null)
                        this.trackData.defaultDuration = defaultDuration;
                    else
                        return null;
                    break;
                case 0x86:
                    var codecID = this.dataInterface.readString(this.currentElement.size);
                    if (codecID !== null)
                        this.trackData.codecID = codecID;
                    else
                        return null;
                    break;
                case 0x9C:
                    var lacing = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (lacing !== null)
                        this.trackData.lacing = lacing;
                    else
                        return null;
                    break;
                case 0xB9:
                    var flagEnabled = this.dataInterface.getBinary(this.currentElement.size);
                    if (flagEnabled !== null) {
                        this.trackData.flagEnabled = flagEnabled;
                    } else {
                        return null;
                    }
                    break;
                case 0x55AA:
                    var flagForced = this.dataInterface.getBinary(this.currentElement.size);
                    if (flagForced !== null) {
                        this.trackData.flagForced = flagForced;
                    } else {
                        return null;
                    }
                    break;
                case 0x63A2:
                    var codecPrivate = this.dataInterface.getBinary(this.currentElement.size);
                    if (codecPrivate !== null) {
                        this.trackData.codecPrivate = codecPrivate;
                    } else {
                        return null;
                    }
                    break;
                case 0x56AA:
                    var codecDelay = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (codecDelay !== null)
                        this.trackData.codecDelay = codecDelay;
                    else
                        return null;
                    break;
                case 0x56BB:
                    var seekPreRoll = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (seekPreRoll !== null)
                        this.trackData.seekPreRoll = seekPreRoll;
                    else
                        return null;
                    break;
                case 0x73C5:
                    var trackUID = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (trackUID !== null)
                        this.trackData.trackUID = trackUID;
                    else
                        return null;
                    break;
                case 0x6DE7:
                    var minCache = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (minCache !== null)
                        this.trackData.minCache = minCache;
                    else
                        return null;
                    break;
                case 0xbf:
                    var crc = this.dataInterface.getBinary(this.currentElement.size);
                    if (crc !== null)
                        ;
                    else
                        return null;
                    break;
                case 0x88:
                    var flagDefault = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (flagDefault !== null)
                        this.flagDefault = flagDefault;
                    else
                        return null;
                    break;
                default:
                    if (!this.dataInterface.peekBytes(this.currentElement.size))
                        return false;
                    else
                        this.dataInterface.skipBytes(this.currentElement.size);
                    console.warn("track data element not found, skipping : " + this.currentElement.id.toString(16));
                    break;
            }
            this.currentElement = null;
        }
        this.loaded = true;
    }

    getTrackEntry() {
        this.tempTrack = this.tempTrack || new Track_1();
        this.tempTrack.loadMeta(this.trackData);
        var tempTrack = this.tempTrack;
        this.tempTrack = null;
        this.loading = false;
        return tempTrack;
    }
}

var Tracks_1 = Tracks;

const NO_LACING = 0;
const XIPH_LACING = 1;
const FIXED_LACING = 2;
const EBML_LACING = 3;

class SimpleBlock {
    constructor() {
        this.cluster;
        this.dataInterface;
        this.offset;
        this.dataOffset;
        this.size;
        this.end;
        this.loaded = false;
        this.trackNumber = null;
        this.timeCode = -1;
        this.flags = null;
        this.keyframe = false;
        this.invisible = false;
        this.lacing = NO_LACING;
        this.discardable = false;
        this.lacedFrameCount = null;
        this.headerSize = null;
        this.frameSizes = [];
        this.tempCounter = null;
        this.tempFrame = null;
        this.track = null;
        this.frameLength = null;
        this.isLaced = false;
        this.stop = null;
        this.status = false;
        this.ebmlLacedSizes = [];
        this.ebmlParsedSizes = [];
        this.ebmlLacedSizesParsed = false;
    }

    init(offset, size, end, dataOffset, dataInterface, cluster) {
        this.cluster = cluster;
        this.dataInterface = dataInterface;
        this.offset = offset;
        this.dataOffset = dataOffset;
        this.size = size;
        this.end = end;
        this.loaded = false;
        this.trackNumber = null;
        this.timeCode = null;
        this.flags = null;
        this.keyframe = false;
        this.invisible = false;
        this.lacing = NO_LACING;
        this.discardable = false;
        this.lacedFrameCount = null;
        this.headerSize = null;
        this.frameSizes = [];
        this.tempCounter = null;
        this.tempFrame = null;
        this.track = null;
        this.frameLength = null;
        this.isLaced = false;
        this.stop = this.offset + this.size;
        this.status = true;
        this.trackEntries = this.cluster.demuxer.tracks.trackEntries;
        this.videoPackets = this.cluster.demuxer.videoPackets;
        this.audioPackets = this.cluster.demuxer.audioPackets;
        this.laceFrameHelper = null;
        this.lacedFrameHeaderSize = null;
        this.ebmlLacedSizes = [];
        this.lacedFrameDataSize = null;
        this.fixedFrameLength = null;
        this.firstLacedFrameSize = null;
        this.ebmlParsedSizes = [];
        this.ebmlLacedSizesParsed = false;
    }

    reset() {
        this.status = false;
    }

    loadTrack() {
        this.track = this.trackEntries[this.trackNumber - 1];
    }

    load() {
        var dataInterface = this.dataInterface;
        if (this.loaded) {
            throw new Error('ALREADY LOADED');
        }
        if (this.trackNumber === null) {
            this.trackNumber = dataInterface.readVint();
            if (this.trackNumber === null)
                return null;
            this.loadTrack();
        }
        if (this.timeCode === null) {
            this.timeCode = dataInterface.readUnsignedInt(2);
            if (this.timeCode === null)
                return null;
        }
        if (this.flags === null) {
            this.flags = dataInterface.readUnsignedInt(1);
            if (this.flags === null)
                return null;
            this.keyframe = (((this.flags >> 7) & 0x01) === 0) ? false : true;
            this.invisible = (((this.flags >> 2) & 0x01) === 0) ? true : false;
            this.lacing = ((this.flags & 0x06) >> 1);
            if (this.lacing > 3 || this.lacing < 0)
                throw "INVALID LACING";
        }
        if (!this.headerSize)
            this.headerSize = dataInterface.offset - this.dataOffset;
        switch (this.lacing) {
            case FIXED_LACING:
                if (!this.frameLength) {
                    this.frameLength = this.size - this.headerSize;
                    if (this.frameLength <= 0)
                        throw "INVALID FRAME LENGTH " + this.frameLength;
                }
                if (!this.lacedFrameCount) {
                    this.lacedFrameCount = dataInterface.readUnsignedInt(1);
                    if (this.lacedFrameCount === null)
                        return null;
                    this.lacedFrameCount++;
                }
                var tempFrame = dataInterface.getBinary(this.frameLength - 1);
                if (tempFrame === null) {
                    return null;
                }
                this.fixedFrameLength = (this.frameLength - 1) / this.lacedFrameCount;
                var fullTimeCode = this.timeCode + this.cluster.timeCode;
                var timeStamp = fullTimeCode / 1000;
                if (timeStamp < 0) {
                    throw "INVALID TIMESTAMP";
                }
                for (var i = 0; i < this.lacedFrameCount; i++) {
                    if (this.track.trackType === 1) {
                        this.videoPackets.push({
                            data: tempFrame.slice(i * this.fixedFrameLength, i * this.fixedFrameLength + this.fixedFrameLength),
                            timestamp: timeStamp,
                            keyframeTimestamp: timeStamp,
                            isKeyframe: this.keyFrame
                        });
                    } else if (this.track.trackType === 2) {
                        this.audioPackets.push({
                            data: tempFrame.slice(i * this.fixedFrameLength, i * this.fixedFrameLength + this.fixedFrameLength),
                            timestamp: timeStamp
                        });
                    }
                }
                tempFrame = null;
                break;
            case EBML_LACING:
                if (!this.frameLength) {
                    this.frameLength = this.size - this.headerSize;
                    if (this.frameLength <= 0)
                        throw "INVALID FRAME LENGTH " + this.frameLength;
                }
                if (!this.lacedFrameCount) {
                    this.lacedFrameCount = dataInterface.readUnsignedInt(1);
                    if (this.lacedFrameCount === null)
                        return null;
                    this.lacedFrameCount++;
                }
                if (!this.firstLacedFrameSize) {
                    var firstLacedFrameSize = this.dataInterface.readVint();
                    if (firstLacedFrameSize !== null) {
                        this.firstLacedFrameSize = firstLacedFrameSize;
                        this.ebmlLacedSizes.push(this.firstLacedFrameSize);
                    } else {
                        return null;
                    }
                }
                if (!this.tempCounter) {
                    this.tempCounter = 0;
                }
                while (this.tempCounter < this.lacedFrameCount - 1) {
                    var frameSize = dataInterface.readLacingSize();
                    if (frameSize === null)
                        return null;
                    this.ebmlLacedSizes.push(frameSize);
                    this.tempCounter++;
                }
                if (!this.ebmlLacedSizesParsed) {
                    this.ebmlParsedSizes[0] = this.ebmlLacedSizes[0];
                    var total = this.ebmlParsedSizes[0];
                    for (var i = 1; i < this.lacedFrameCount - 1; i++) {
                        this.ebmlParsedSizes[i] = this.ebmlLacedSizes[i] + this.ebmlParsedSizes[i - 1];
                        total += this.ebmlParsedSizes[i];
                    }
                    if (!this.lacedFrameDataSize)
                        this.lacedFrameDataSize = this.end - dataInterface.offset;
                    var lastSize = this.lacedFrameDataSize - total;
                    this.ebmlParsedSizes.push(lastSize);
                    this.ebmlLacedSizesParsed = true;
                    this.ebmlTotalSize = total + lastSize;
                }
                var tempFrame = dataInterface.getBinary(this.lacedFrameDataSize);
                if (tempFrame === null) {
                    return null;
                }
                var fullTimeCode = this.timeCode + this.cluster.timeCode;
                var timeStamp = fullTimeCode / 1000;
                if (timeStamp < 0) {
                    throw "INVALID TIMESTAMP";
                }
                var start = 0;
                var end = this.ebmlParsedSizes[0];
                for (var i = 0; i < this.lacedFrameCount; i++) {
                    if (this.track.trackType === 1) {
                        this.videoPackets.push({
                            data: tempFrame.slice(start, end),
                            timestamp: timeStamp,
                            keyframeTimestamp: timeStamp,
                            isKeyframe: this.keyFrame
                        });
                    } else if (this.track.trackType === 2) {
                        this.audioPackets.push({
                            data: tempFrame.slice(start, end),
                            timestamp: timeStamp
                        });
                    }
                    start += this.ebmlParsedSizes[i];
                    end += this.ebmlParsedSizes[i];
                    if (i === this.lacedFrameCount - 1) {
                        end = null;
                    }
                }
                this.tempCounter = null;
                tempFrame = null;
                break;
            case XIPH_LACING:
            case NO_LACING:
                if (this.lacing === EBML_LACING) {
                    console.warn("EBML_LACING");
                }
                if (this.lacing === XIPH_LACING) {
                    console.warn("XIPH_LACING");
                }
                if (!this.frameLength) {
                    this.frameLength = this.size - this.headerSize;
                    if (this.frameLength <= 0)
                        throw "INVALID FRAME LENGTH " + this.frameLength;
                }
                var tempFrame = dataInterface.getBinary(this.frameLength);
                if (tempFrame === null) {
                    return null;
                } else {
                    if (dataInterface.usingBufferedRead === true)
                        throw "SHOULD NOT BE BUFFERED READ";
                    if (tempFrame.byteLength !== this.frameLength)
                        throw "INVALID FRAME";
                }
                var fullTimeCode = this.timeCode + this.cluster.timeCode;
                var timeStamp = fullTimeCode / 1000;
                if (timeStamp < 0) {
                    throw "INVALID TIMESTAMP";
                }
                if (this.track.trackType === 1) {
                    this.videoPackets.push({
                        data: tempFrame,
                        timestamp: timeStamp,
                        keyframeTimestamp: timeStamp,
                        isKeyframe: this.keyFrame
                    });
                } else if (this.track.trackType === 2) {
                    this.audioPackets.push({
                        data: tempFrame,
                        timestamp: timeStamp
                    });
                }
                tempFrame = null;
                break;
            default:
                console.log(this);
                console.warn("LACED ELEMENT FOUND");
                throw "STOP HERE";
        }
        if (this.end !== dataInterface.offset) {
            throw new Error('INVALID BLOCK SIZE');
        }
        this.loaded = true;
        this.headerSize = null;
        this.tempFrame = null;
        this.tempCounter = null;
        this.frameLength = null;
    }
}

var SimpleBlock_1 = SimpleBlock;

class BlockGroup {
    constructor(blockGroupHeader, dataInterface) {
        this.dataInterface = dataInterface;
        this.offset = blockGroupHeader.offset;
        this.size = blockGroupHeader.size;
        this.end = blockGroupHeader.end;
        this.loaded = false;
        this.tempElement = null;
        this.currentElement = null;
    }

    load() {
        var end = this.end;
        while (this.dataInterface.offset < end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0xA1:
                    var block = this.dataInterface.getBinary(this.currentElement.size);
                    if (block !== null)
                        ;
                    else
                        return null;
                    break;
                case 0x9b:
                    var blockDuration = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (blockDuration !== null)
                        this.blockDuration = blockDuration;
                    else
                        return null;
                    break;
                case 0xFB:
                    var referenceBlock = this.dataInterface.readSignedInt(this.currentElement.size);
                    if (referenceBlock !== null)
                        this.referenceBlock = referenceBlock;
                    else
                        return null;
                    break;
                case 0x75A2:
                    var discardPadding = this.dataInterface.readSignedInt(this.currentElement.size);
                    if (discardPadding !== null)
                        this.discardPadding = discardPadding;
                    else
                        return null;
                    break;
                default:
                    console.warn("block group element not found, skipping " + this.currentElement.id.toString(16));
                    break;
            }
            this.currentElement = null;
        }
        this.loaded = true;
    }
}

var BlockGroup_1 = BlockGroup;

class Cluster {
    constructor(offset, size, end, dataOffset, dataInterface, demuxer) {
        this.demuxer = demuxer;
        this.dataInterface = dataInterface;
        this.offset = offset;
        this.size = size;
        this.end = end;
        this.dataOffset = dataOffset;
        this.loaded = false;
        this.tempEntry = null;
        this.currentElement = null;
        this.timeCode = null;
        this.tempBlock = null;
        this.position = null;
        this.tempElementHeader = new ElementHeader_1(-1, -1, -1, -1);
        this.tempElementHeader.reset();
        this.tempBlock = new SimpleBlock_1();
        this.blockGroups = [];
        return true;
    }

    init() {
    }

    reset() {
    }

    load() {
        var status = false;
        while (this.dataInterface.offset < this.end) {
            if (!this.tempElementHeader.status) {
                this.dataInterface.peekAndSetElement(this.tempElementHeader);
                if (!this.tempElementHeader.status)
                    return null;
            }
            switch (this.tempElementHeader.id) {
                case 0xE7:
                    var timeCode = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
                    if (timeCode !== null) {
                        this.timeCode = timeCode;
                    } else {
                        return null;
                    }
                    break;
                case 0xA3:
                    if (!this.tempBlock.status)
                        this.tempBlock.init(
                            this.tempElementHeader.offset,
                            this.tempElementHeader.size,
                            this.tempElementHeader.end,
                            this.tempElementHeader.dataOffset,
                            this.dataInterface,
                            this
                        );
                    this.tempBlock.load();
                    if (!this.tempBlock.loaded)
                        return 0;
                    this.tempBlock.reset();
                    this.tempEntry = null;
                    this.tempElementHeader.reset();
                    if (this.dataInterface.offset !== this.end) {
                        if (!this.dataInterface.currentBuffer)
                            return false;
                        return true;
                    }
                    break;
                case 0xA7:
                    var timeCode = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
                    if (timeCode !== null) {
                        this.timeCode = timeCode;
                    } else {
                        return null;
                    }
                    break;
                case 0xA0:
                    if (!this.currentBlockGroup)
                        this.currentBlockGroup = new BlockGroup_1(this.tempElementHeader.getData(), this.dataInterface);
                    this.currentBlockGroup.load();
                    if (!this.currentBlockGroup.loaded)
                        return false;
                    this.blockGroups.push(this.currentTag);
                    this.currentBlockGroup = null;
                    break;
                case 0xAB:
                    var prevSize = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
                    if (prevSize !== null)
                        this.prevSize = prevSize;
                    else
                        return null;
                    break;
                case 0xBF:
                    var crc = this.dataInterface.getBinary(this.tempElementHeader.size);
                    if (crc !== null)
                        ;
                    else
                        return null;
                    break;
                default:
                    console.warn("cluster data element not found, skipping : " + this.tempElementHeader.id.toString(16));
                    break;
            }
            this.tempEntry = null;
            this.tempElementHeader.reset();
        }
        this.loaded = true;
        return status;
    }
}

var Cluster_1 = Cluster;

class CueTrackPositions {
    constructor(cuesPointHeader, dataInterface) {
        this.dataInterface = dataInterface;
        this.offset = cuesPointHeader.offset;
        this.size = cuesPointHeader.size;
        this.end = cuesPointHeader.end;
        this.loaded = false;
        this.tempElement = null;
        this.currentElement = null;
        this.cueTrack = null;
        this.cueClusterPosition = 0;
        this.cueRelativePosition = 0;
    }

    load() {
        while (this.dataInterface.offset < this.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0xF7:
                    var cueTrack = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (cueTrack !== null)
                        this.cueTrack = cueTrack;
                    else
                        return null;
                    break;
                case 0xF1:
                    var cueClusterPosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (cueClusterPosition !== null)
                        this.cueClusterPosition = cueClusterPosition;
                    else
                        return null;
                    break;
                case 0xF0:
                    var cueRelativePosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (cueRelativePosition !== null)
                        this.cueRelativePosition = cueRelativePosition;
                    else
                        return null;
                    break;
                default:
                    console.warn("Cue track positions not found! " + this.currentElement.id);
                    break;
            }
            this.currentElement = null;
        }
        if (this.dataInterface.offset !== this.end) {
            throw new Error('Invalid Seek Formatting');
        }
        this.loaded = true;
    }
}

var CueTrackPositions_1 = CueTrackPositions;

class Cues {
    constructor(cuesHeader, dataInterface, demuxer) {
        this.dataInterface = dataInterface;
        this.offset = cuesHeader.offset;
        this.size = cuesHeader.size;
        this.end = cuesHeader.end;
        this.entries = [];
        this.loaded = false;
        this.tempEntry = null;
        this.demuxer = demuxer;
        this.currentElement = null;
    }

    load() {
        const end = this.end;
        while (this.dataInterface.offset < end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0xBB:
                    if (!this.tempEntry)
                        this.tempEntry = new CuePoint(this.currentElement, this.dataInterface);
                    this.tempEntry.load();
                    if (!this.tempEntry.loaded)
                        return;
                    else
                        this.entries.push(this.tempEntry);
                    break;
                case 0xbf:
                    var crc = this.dataInterface.getBinary(this.currentElement.size);
                    if (crc !== null)
                        ;
                    else
                        return null;
                    break;
                default:
                    console.warn("Cue Head element not found " + this.currentElement.id.toString(16));
                    break;
            }
            this.tempEntry = null;
            this.currentElement = null;
        }
        if (this.dataInterface.offset !== this.end) {
            throw new Error('INVALID CUE FORMATTING');
        }
        this.loaded = true;
    }

    getCount() {
        return this.cuePoints.length;
    }

    init() {
    }

    preloadCuePoint() {
    }

    find() {
    }

    getFirst() {
    }

    getLast() {
    }

    getNext() {
    }

    getBlock() {
    }

    findOrPreloadCluster() {
    }
}

class CuePoint {
    constructor(cuesPointHeader, dataInterface) {
        this.dataInterface = dataInterface;
        this.offset = cuesPointHeader.offset;
        this.size = cuesPointHeader.size;
        this.end = cuesPointHeader.end;
        this.loaded = false;
        this.tempElement = null;
        this.currentElement = null;
        this.cueTime = null;
        this.cueTrackPositions = null;
    }

    load() {
        const end = this.end;
        while (this.dataInterface.offset < end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0xB7:
                    if (!this.cueTrackPositions)
                        this.cueTrackPositions = new CueTrackPositions_1(this.currentElement, this.dataInterface);
                    this.cueTrackPositions.load();
                    if (!this.cueTrackPositions.loaded)
                        return;
                    break;
                case 0xB3:
                    var cueTime = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (cueTime !== null)
                        this.cueTime = cueTime;
                    else
                        return null;
                    break;
                default:
                    console.warn("Cue Point not found, skipping");
                    break;
            }
            this.currentElement = null;
        }
        this.loaded = true;
    }
}

var Cues_1 = Cues;

class Targets {
    constructor(targetsHeader, dataInterface) {
        this.dataInterface = dataInterface;
        this.offset = targetsHeader.offset;
        this.size = targetsHeader.size;
        this.end = targetsHeader.end;
        this.loaded = false;
        this.tempElement = null;
        this.currentElement = null;
        this.cueTrack = null;
        this.cueClusterPosition = 0;
        this.cueRelativePosition = 0;
    }

    load() {
        while (this.dataInterface.offset < this.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null) return null;
            }
            switch (this.currentElement.id) {
                case 0x63C5:
                    var tagTrackUID = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (tagTrackUID !== null) this.tagTrackUID = tagTrackUID;
                    else
                        return null;
                    break;
                case 0x68CA:
                    var targetTypeValue = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (targetTypeValue !== null) this.targetTypeValue = targetTypeValue;
                    else
                        return null;
                    break;
                default:
                    if (!this.dataInterface.peekBytes(this.currentElement.size)) {
                        return false;
                    } else {
                        this.dataInterface.skipBytes(this.currentElement.size);
                    }
                    console.warn("targets element not found ! : " + this.currentElement.id.toString(16));
                    break;
            }
            this.currentElement = null;
        }
        if (this.dataInterface.offset !== this.end)
            console.error('Invalid Targets Formatting');
        this.loaded = true;
    }
}

var Targets_1 = Targets;

class SimpleTag {
    constructor(simpleTagHeader, dataInterface) {
        this.dataInterface = dataInterface;
        this.offset = simpleTagHeader.offset;
        this.size = simpleTagHeader.size;
        this.end = simpleTagHeader.end;
        this.loaded = false;
        this.tempElement = null;
        this.currentElement = null;
        this.cueTrack = null;
        this.cueClusterPosition = 0;
        this.cueRelativePosition = 0;
        this.tagName = null;
        this.tagString = null;
    }

    load() {
        while (this.dataInterface.offset < this.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0x45A3:
                    var tagName = this.dataInterface.readString(this.currentElement.size);
                    if (tagName !== null)
                        this.tagName = tagName;
                    else
                        return null;
                    break;
                case 0x4487:
                    var tagString = this.dataInterface.readString(this.currentElement.size);
                    if (tagString !== null)
                        this.tagString = tagString;
                    else
                        return null;
                    break;
                case 0x4484:
                    var tagDefault = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (tagDefault !== null) this.tagDefault = tagDefault;
                    else
                        return null;
                    break;
                case 0x447A:
                    var tagLanguage = this.dataInterface.readSignedInt(this.currentElement.size);
                    if (tagLanguage !== null) this.tagLanguage = tagLanguage;
                    else
                        return null;
                    break;
                default:
                    if (!this.dataInterface.peekBytes(this.currentElement.size))
                        return false;
                    else
                        this.dataInterface.skipBytes(this.currentElement.size);
                    console.warn("simple tag element not found ! : " + this.currentElement.id.toString(16));
                    break;
            }
            this.currentElement = null;
        }
        if (this.dataInterface.offset !== this.end)
            console.error("Invalid Targets Formatting");
        this.loaded = true;
    }
}

var SimpleTag_1 = SimpleTag;

class Tag {
    constructor(tagHeader, dataInterface, demuxer) {
        this.dataInterface = dataInterface;
        this.offset = tagHeader.offset;
        this.size = tagHeader.size;
        this.end = tagHeader.end;
        this.entries = [];
        this.loaded = false;
        this.tempEntry = null;
        this.demuxer = demuxer;
        this.currentElement = null;
        this.targets = [];
        this.simpleTags = [];
    }

    load() {
        var end = this.end;
        while (this.dataInterface.offset < end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0x63C0:
                    if (!this.tempEntry)
                        this.tempEntry = new Targets_1(this.currentElement, this.dataInterface);
                    this.tempEntry.load();
                    if (!this.tempEntry.loaded)
                        return null;
                    this.targets.push(this.tempEntry);
                    this.tempEntry = null;
                    break;
                case 0x67C8:
                    if (!this.tempEntry)
                        this.tempEntry = new SimpleTag_1(this.currentElement, this.dataInterface);
                    this.tempEntry.load();
                    if (!this.tempEntry.loaded)
                        return null;
                    this.simpleTags.push(this.tempEntry);
                    this.tempEntry = null;
                    break;
                default:
                    if (!this.dataInterface.peekBytes(this.currentElement.size))
                        return false;
                    else
                        this.dataInterface.skipBytes(this.currentElement.size);
                    console.warn("tag element not found: " + this.currentElement.id.toString(16));
                    break;
            }
            this.tempEntry = null;
            this.currentElement = null;
        }
        if (this.dataInterface.offset !== this.end) {
            console.log(this);
            throw "INVALID CUE FORMATTING";
        }
        this.loaded = true;
    }
}

var Tag_1 = Tag;

class Tags {
    constructor(tagsHeader, dataInterface) {
        this.dataInterface = dataInterface;
        this.offset = tagsHeader.offset;
        this.size = tagsHeader.size;
        this.end = tagsHeader.end;
        this.entries = [];
        this.loaded = false;
        this.tempEntry = null;
        this.currentElement = null;
        this.currentTag = null;
        this.tags = [];
    }

    load() {
        var end = this.end;
        while (this.dataInterface.offset < end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }
            switch (this.currentElement.id) {
                case 0x7373:
                    if (!this.currentTag)
                        this.currentTag = new Tag_1(this.currentElement.getData(), this.dataInterface);
                    this.currentTag.load();
                    if (!this.currentTag.loaded)
                        return false;
                    this.tags.push(this.currentTag);
                    this.currentTag = null;
                    break;
                case 0xbf:
                    var crc = this.dataInterface.getBinary(this.currentElement.size);
                    if (crc !== null)
                        ;
                    else
                        return null;
                    break;
                default:
                    if (!this.dataInterface.peekBytes(this.currentElement.size))
                        return false;
                    else
                        this.dataInterface.skipBytes(this.currentElement.size);
                    console.warn("tags element not found, skipping" + this.currentElement.id.toString(16));
                    break;
            }
            this.currentElement = null;
        }
        this.loaded = true;
    }
}

var Tags_1 = Tags;

const STATE_INITIAL = 0;
const STATE_DECODING = 1;
const STATE_SEEKING = 2;
const META_LOADED = 3;
const STATE_FINISHED = 4;

class WebmDemuxer {
    constructor() {
        this.shown = false;
        this.clusters = [];
        this.segmentInfo = [];
        this.state = STATE_INITIAL;
        this.videoPackets = [];
        this.audioPackets = [];
        this.loadedMetadata = false;
        this.seekable = true;
        this.dataInterface = new DataInterface_1(this);
        this.segment = null;
        this.currentElement = null;
        this.segmentIsLoaded = false;
        this.segmentDataOffset;
        this.headerIsLoaded = false;
        this.tempElementHeader = new ElementHeader_1(-1, -1, -1, -1);
        this.tempElementHeader.reset();
        this.currentElement = null;
        this.segmentInfo = null;
        this.tracks = null;
        this.currentCluster = null;
        this.cpuTime = 0;
        this.seekHead = null;
        this.cuesLoaded = false;
        this.isSeeking = false;
        this.tempSeekPosition = -1;
        this.loadingCues = false;
        this.seekCueTarget = null;
        this.eof = false;
        this.videoFormat = null;
        this.audioFormat = null;
        this.videoCodec = null;
        this.audioFormat = null;
        this.videoTrack = null;
        this.audioTrack = null;
        this.processing = false;
        Object.defineProperty(this, 'duration', {
            get: function () {
                if (this.segmentInfo.duration < 0)
                    return -1;
                return this.segmentInfo.duration / 1000;
            }
        });
        Object.defineProperty(this, 'keyframeTimestamp', {
            get: function () {
                if (this.videoPackets.length > 0) {
                    return this.videoPackets[0].keyframeTimestamp;
                } else {
                    return -1;
                }
            }
        });
    }

    validateMetadata() {
        var codecID;
        var channels;
        var rate;
        var tempTrack;
        for (var i in this.tracks.trackEntries) {
            var trackEntry = this.tracks.trackEntries[i];
            if (trackEntry.trackType === 2) {
                tempTrack = trackEntry;
                codecID = trackEntry.codecID;
                channels = trackEntry.channels;
                rate = trackEntry.rate;
                break;
            }
        }
        this.audioTrack = tempTrack;
        switch (codecID) {
            case "A_VORBIS":
                this.audioCodec = "vorbis";
                this.initVorbisHeaders(tempTrack);
                break;
            case "A_OPUS":
                this.audioCodec = "opus";
                this.initOpusHeaders(tempTrack);
                break;
            case "A_AAC":
                this.audioCodec = "aac";
                this.initAacHeaders(tempTrack);
                break;
            default:
                this.audioCodec = null;
                break;
        }
        for (var i in this.tracks.trackEntries) {
            var trackEntry = this.tracks.trackEntries[i];
            if (trackEntry.trackType === 1) {
                tempTrack = trackEntry;
                codecID = trackEntry.codecID;
                break;
            }
        }
        switch (codecID) {
            case "V_VP8":
                this.videoCodec = "vp8";
                break;
            case "V_VP9":
                this.videoCodec = "vp9";
                break;
            default:
                this.videoCodec = null;
                break;
        }
        this.videoTrack = tempTrack;
        var fps = 0;
        this.videoFormat = {
            width: tempTrack.width,
            height: tempTrack.height,
            chromaWidth: tempTrack.width >> 1,
            chromaHeight: tempTrack.height >> 1,
            cropLeft: tempTrack.pixelCropLeft,
            cropTop: tempTrack.pixelCropTop,
            cropWidth: tempTrack.width - tempTrack.pixelCropLeft - tempTrack.pixelCropRight,
            cropHeight: tempTrack.height - tempTrack.pixelCropTop - tempTrack.pixelCropBottom,
            displayWidth: tempTrack.displayWidth,
            displayHeight: tempTrack.displayHeight,
            fps: fps
        };
        this.loadedMetadata = true;
    }

    initOpusHeaders(trackEntry) {
        this.audioTrack = trackEntry;
    }

    initVorbisHeaders(trackEntry) {
        var headerParser = new DataView(trackEntry.codecPrivate);
        var packetCount = headerParser.getUint8(0);
        var firstLength = headerParser.getUint8(1);
        var secondLength = headerParser.getUint8(2);
        var thirdLength = headerParser.byteLength - firstLength - secondLength - 1;
        if (packetCount !== 2)
            throw "INVALID VORBIS HEADER";
        var start = 3;
        var end = start + firstLength;
        this.audioPackets.push({
            data: headerParser.buffer.slice(start, end),
            timestamp: -1
        });
        start = end;
        end = start + secondLength;
        this.audioPackets.push({
            data: headerParser.buffer.slice(start, end),
            timestamp: -1
        });
        start = end;
        end = start + thirdLength;
        this.audioPackets.push({
            data: headerParser.buffer.slice(start, end),
            timestamp: -1
        });
        this.audioTrack = trackEntry;
    }

    initAacHeaders(trackEntry) {
        this.audioTrack = trackEntry;
    }

    queueData(data) {
        this.dataInterface.recieveInput(data);
    }

    demux() {
        switch (this.state) {
            case STATE_INITIAL:
                this.initDemuxer();
                if (this.state !== STATE_DECODING)
                    break;
            case STATE_DECODING:
                this.load();
                break;
            case STATE_SEEKING:
                this.processSeeking();
                break;
            default:
                console.warn('INVALID STATE');
        }
    }

    load() {
        var status = false;
        while (this.dataInterface.offset < this.segment.end) {
            if (!this.tempElementHeader.status) {
                this.dataInterface.peekAndSetElement(this.tempElementHeader);
                if (!this.tempElementHeader.status)
                    return null;
            }
            switch (this.tempElementHeader.id) {
                case 0x114D9B74:
                    if (!this.seekHead)
                        this.seekHead = new SeekHead_1(this.tempElementHeader.getData(), this.dataInterface);
                    this.seekHead.load();
                    if (!this.seekHead.loaded)
                        return false;
                    break;
                case 0xEC:
                    var skipped = this.dataInterface.skipBytes(this.tempElementHeader.size);
                    if (skipped === false)
                        return;
                    break;
                case 0x1549A966:
                    if (!this.segmentInfo)
                        this.segmentInfo = new SegmentInfo_1(this.tempElementHeader.getData(), this.dataInterface);
                    this.segmentInfo.load();
                    if (!this.segmentInfo.loaded)
                        return false;
                    break;
                case 0x1654AE6B:
                    if (!this.tracks)
                        this.tracks = new Tracks_1(this.tempElementHeader.getData(), this.dataInterface, this);
                    this.tracks.load();
                    if (!this.tracks.loaded)
                        return false;
                    break;
                case 0x1C53BB6B:
                    if (!this.cues)
                        this.cues = new Cues_1(this.tempElementHeader.getData(), this.dataInterface, this);
                    this.cues.load();
                    if (!this.cues.loaded)
                        return false;
                    this.cuesLoaded = true;
                    break;
                case 0x1254c367:
                    if (!this.tags)
                        this.tags = new Tags_1(this.tempElementHeader.getData(), this.dataInterface, this);
                    this.tags.load();
                    if (!this.tags.loaded)
                        return false;
                    break;
                case 0x1F43B675:
                    if (!this.loadedMetadata) {
                        this.validateMetadata();
                        return true;
                    }
                    if (!this.currentCluster) {
                        this.currentCluster = new Cluster_1(
                            this.tempElementHeader.offset,
                            this.tempElementHeader.size,
                            this.tempElementHeader.end,
                            this.tempElementHeader.dataOffset,
                            this.dataInterface,
                            this
                        );
                    }
                    status = this.currentCluster.load();
                    if (!this.currentCluster.loaded) {
                        return status;
                    }
                    this.currentCluster = null;
                    break;
                default:
                    this.state = META_LOADED;
                    var skipped = this.dataInterface.skipBytes(this.tempElementHeader.size);
                    if (skipped === false)
                        return;
                    console.log("UNSUPORTED ELEMENT FOUND, SKIPPING : " + this.tempElementHeader.id.toString(16));
                    break;
            }
            this.tempElementHeader.reset();
        }
        this.eof = true;
        this.state = STATE_FINISHED;
        return status;
    }

    initDemuxer() {
        var dataInterface = this.dataInterface;
        if (!this.headerIsLoaded) {
            if (!this.elementEBML) {
                this.elementEBML = dataInterface.peekElement();
                if (!this.elementEBML)
                    return null;
                if (this.elementEBML.id !== 0x1A45DFA3) {
                    console.warn('INVALID PARSE, HEADER NOT LOCATED');
                }
            }
            var end = this.elementEBML.end;
            while (dataInterface.offset < end) {
                if (!this.tempElementHeader.status) {
                    dataInterface.peekAndSetElement(this.tempElementHeader);
                    if (!this.tempElementHeader.status)
                        return null;
                }
                switch (this.tempElementHeader.id) {
                    case 0x4286:
                        var version = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (version !== null)
                            this.version = version;
                        else
                            return null;
                        break;
                    case 0x42F7:
                        var readVersion = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (readVersion !== null)
                            this.readVersion = readVersion;
                        else
                            return null;
                        break;
                    case 0x42F2:
                        var maxIdLength = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (maxIdLength !== null)
                            this.maxIdLength = maxIdLength;
                        else
                            return null;
                        break;
                    case 0x42F3:
                        var maxSizeLength = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (maxSizeLength !== null)
                            this.maxSizeLength = maxSizeLength;
                        else
                            return null;
                        break;
                    case 0x4282:
                        var docType = dataInterface.readString(this.tempElementHeader.size);
                        if (docType !== null)
                            this.docType = docType;
                        else
                            return null;
                        break;
                    case 0x4287:
                        var docTypeVersion = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (docTypeVersion !== null)
                            this.docTypeVersion = docTypeVersion;
                        else
                            return null;
                        break;
                    case 0x4285:
                        var docTypeReadVersion = dataInterface.readUnsignedInt(this.tempElementHeader.size);
                        if (docTypeReadVersion !== null)
                            this.docTypeReadVersion = docTypeReadVersion;
                        else
                            return null;
                        break;
                    case 0xbf:
                        var crc = dataInterface.getBinary(this.tempElementHeader.size);
                        if (crc !== null)
                            ;
                        else
                            return null;
                        break;
                    default:
                        console.warn("UNSUPORTED HEADER ELEMENT FOUND, SKIPPING : " + this.tempElementHeader.id.toString(16));
                        break;
                }
                this.tempElementHeader.reset();
            }
            this.headerIsLoaded = true;
        }
        if (!this.currentElement)
            this.currentElement = this.dataInterface.peekElement();
        if (!this.currentElement)
            return null;
        switch (this.currentElement.id) {
            case 0x18538067:
                this.segment = this.currentElement;
                break;
            case 0xEC:
                var skipped = this.dataInterface.skipBytes(this.tempElementHeader.size);
                if (skipped === false)
                    return null;
                break;
            default:
                console.warn("Global element not found, id: " + this.currentElement.id);
        }
        this.currentElement = null;
        this.segmentIsLoaded = true;
        this.state = STATE_DECODING;
    }

    _flush() {
        this.audioPackets = [];
        this.videoPackets = [];
        this.dataInterface.flush();
        this.tempElementHeader = new ElementHeader_1(-1, -1, -1, -1);
        this.tempElementHeader.reset();
        this.currentElement = null;
        this.currentCluster = null;
        this.eof = false;
    }

    processSeeking() {
        if (!this.cuesLoaded) {
            if (!this.cuesOffset) {
                this.initCues();
                this._flush();
                this.dataInterface.offset = this.cuesOffset;
                this.onseek(this.cuesOffset);
                return 0;
            }
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return 0;
            }
            if (!this.cues)
                this.cues = new Cues_1(this.currentElement, this.dataInterface, this);
            this.cues.load();
            if (!this.cues.loaded)
                return 0;
            this.cuesLoaded = true;
            return 0;
        }
        this.calculateKeypointOffset();
        var clusterOffset = this.seekCueTarget.cueTrackPositions.cueClusterPosition + this.segment.dataOffset;
        this._flush();
        this.dataInterface.offset = clusterOffset;
        this.onseek(clusterOffset);
        this.state = STATE_DECODING;
        return 0;
    }

    initCues() {
        if (!this.cuesOffset) {
            var length = this.seekHead.entries.length;
            var entries = this.seekHead.entries;
            for (var i = 0; i < length; i += 1) {
                if (entries[i].seekId === 0x1C53BB6B)
                    this.cuesOffset = entries[i].seekPosition + this.segment.dataOffset;
            }
        }
    }

    calculateKeypointOffset() {
        var timecodeScale = this.segmentInfo.timecodeScale;
        this.seekTime;
        var cuesPoints = this.cues.entries;
        var length = this.cues.entries.length;
        var scanPoint = cuesPoints[0];
        var tempPoint;
        var i = 1;
        for (i; i < length; i++) {
            tempPoint = cuesPoints[i];
            if (tempPoint.cueTime * timecodeScale > this.seekTime)
                break;
            scanPoint = tempPoint;
        }
        this.seekCueTarget = scanPoint;
    }
}

module.exports = WebmDemuxer;
