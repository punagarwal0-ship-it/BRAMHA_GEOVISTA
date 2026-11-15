`timescale 1ns/1ps
module sar_input_interface_tb;
    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg rst, start, valid_in, pixel_ready;
    reg [7:0] pixel1_in, pixel2_in;
    wire ready_in, pixel_valid_out;
    wire [7:0] pixel1_out, pixel2_out;
    wire [15:0] x_out, y_out;
    wire frame_last, busy, done;
    integer errors;

    sar_input_interface #(.IMAGE_WIDTH(2), .IMAGE_HEIGHT(2), .COORD_WIDTH(16)) dut (
        .clk(clk), .rst(rst), .start(start), .valid_in(valid_in),
        .ready_in(ready_in), .pixel1_in(pixel1_in), .pixel2_in(pixel2_in),
        .pixel_ready(pixel_ready), .pixel_valid_out(pixel_valid_out),
        .pixel1_out(pixel1_out), .pixel2_out(pixel2_out),
        .x_out(x_out), .y_out(y_out), .frame_last(frame_last),
        .busy(busy), .done(done)
    );

    task send_pair;
        input [15:0] ex, ey;
        input [7:0] a, b;
        input expected_last;
        begin
            @(negedge clk);
            valid_in=1'b1; pixel_ready=1'b1; pixel1_in=a; pixel2_in=b;
            #1;
            if (!pixel_valid_out || !ready_in || x_out!==ex || y_out!==ey ||
                pixel1_out!==a || pixel2_out!==b || frame_last!==expected_last) begin
                $display("FAIL transfer expected xy=(%0d,%0d), last=%b got xy=(%0d,%0d), last=%b",
                         ex,ey,expected_last,x_out,y_out,frame_last);
                errors=errors+1;
            end
            @(posedge clk); #1;
            if (done !== expected_last) begin
                $display("FAIL done expected=%b got=%b",expected_last,done);
                errors=errors+1;
            end
        end
    endtask

    initial begin
        errors=0; rst=1; start=0; valid_in=0; pixel_ready=0;
        pixel1_in=0; pixel2_in=0;
        repeat (2) @(posedge clk);
        @(negedge clk); rst=0; start=1;
        @(posedge clk); #1; start=0;
        if (busy !== 1'b1) begin $display("FAIL start did not assert busy"); errors=errors+1; end

        // Invalid bubble and downstream stall must leave coordinate at (0,0).
        @(negedge clk); valid_in=0; pixel_ready=1;
        @(posedge clk); #1;
        @(negedge clk); valid_in=1; pixel_ready=0; pixel1_in=8'h10; pixel2_in=8'h20;
        repeat (2) begin
            @(posedge clk); #1;
            if (x_out!==0 || y_out!==0 || ready_in!==0 || done!==0) begin
                $display("FAIL stalled input advanced state"); errors=errors+1;
            end
        end

        send_pair(0,0,8'h10,8'h20,1'b0);
        send_pair(1,0,8'h11,8'h21,1'b0);
        send_pair(0,1,8'h12,8'h22,1'b0);
        send_pair(1,1,8'h13,8'h23,1'b1);

        if (busy !== 1'b0) begin $display("FAIL busy remained high after final pixel"); errors=errors+1; end
        if (errors==0) $display("PASS: sar_input_interface_tb");
        else $display("FAIL: %0d error(s)",errors);
        $finish;
    end
endmodule
