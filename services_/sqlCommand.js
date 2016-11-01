/*
The MIT License (MIT)

Copyright (c) 2014 microServiceBus.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var exports = module.exports = {
    getCommand : function (message, startBracket, endBracket) {
        var command;
        try {
            startBracket = (startBracket == null ? "" : startBracket);
            endBracket = (endBracket == null ? "" : endBracket);
            var response = { command: null, error: null };
            switch (message.type.toLowerCase()) {
                case 'insert':
                    if (!Array.isArray(message.dataRows))
                        message.dataRows = [message.dataRows];
                    command = '';
                    var columns = '(';
                    
                    // build columns
                    for (var col in message.dataRows[0]) {
                        columns += startBracket + col + endBracket + ',';
                    }
                    columns = columns.replace(/,([^,]*)$/, ')$1'); // Replace the last comma with end bracket
                    
                    message.dataRows.forEach(function (row) {
                        command += 'INSERT INTO ' + startBracket + message.table + endBracket + ' ' + columns + 'VALUES(';
                        
                        for (var col in row) {
                            if (isNaN(row[col]))
                                command += "'" + row[col] + "',";
                            else
                                command += row[col] + ",";
                        }
                        command = command.replace(/,([^,]*)$/, ')$1'); // Replace the last comma with end bracket
                    });
                    break;
                case 'delete':
                    if (message.idColumns == null) {
                        response.error = 'idColumns is not set.';
                        return;
                    }
                    if (message.idValues == null) {
                        response.error = 'idValues is not set.';
                        return;
                    }
                    if (message.idValues.length != message.idColumns.length) {
                        response.error = 'idColumns and idValues is of different length, and does not match.';
                        return;
                    }
                    command = 'DELETE FROM ' + startBracket + message.table + endBracket + ' WHERE ';
                    
                    // Build up where clause
                    var where = "";
                    for (i = 0; i < message.idColumns.length; i++) {
                        var val = "";
                        
                        if (isNaN(message.idValues[i]))
                            val += "'" + message.idValues[i] + "'";
                        else
                            val += message.idValues[i];
                        
                        where += startBracket + message.idColumns[i] + endBracket + " = " + val;
                        
                        if (i < message.idColumns.length - 1)
                            where += " and ";
                    }
                    command += where;
                    break;
                case 'update':
                    if (message.idColumns == null) {
                        response.error = 'idColumns is not set.';
                    }
                    if (!Array.isArray(message.dataRows))
                        message.dataRows = [message.dataRows];
                    
                    command = '';
                    var columns = '(';
                    
                    message.dataRows.forEach(function (row) {
                        command += 'UPDATE ' + startBracket + message.table + endBracket + ' SET ';
                        
                        for (var col in row) {
                            if (message.idColumns.indexOf(col) < 0) { // Don't include id columns...
                                if (isNaN(row[col]))
                                    command += startBracket + col + endBracket + " = '" + row[col] + "', ";
                                else
                                    command += startBracket + col + endBracket + " = " + row[col] + ',';
                            }
                        }
                        command = command.replace(/,([^,]*)$/, '$1'); // Replace the last comma with end bracket
                        command += ' WHERE '
                        var and = '';
                        
                        message.idColumns.forEach(function (id) {
                            command += and + startBracket + id + endBracket + " = ";
                            if (isNaN(row[id]))
                                command += "'" + row[id] + "'";
                            else
                                command += row[id];
                            
                            and = ' AND ';
                        });
                    });
                    break;
                case 'select':
                    command = message.command;
                    break;
                default:
                    response.error = 'Unsupported command type.';
                    return;
            }
            response.command = command;
            return response;
        }
        catch (err) {
            response.error = err;
            return response;
        }
    }
}